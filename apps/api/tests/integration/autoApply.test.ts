import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { closeAutoApplyQueue } from "../../src/jobs/autoApplyQueue.js";

const app = createApp();

const registerBody = {
  email: "auto-applicant@example.com",
  password: "StrongPass1",
  fullName: "Grace Hopper",
};

let accessToken: string;

async function resetData() {
  await prisma.applicationAttempt.deleteMany();
  await prisma.application.deleteMany();
  await prisma.autoApplyRule.deleteMany();
  await prisma.matchResult.deleteMany();
  await prisma.internshipSkill.deleteMany();
  await prisma.internship.deleteMany();
  await prisma.internshipProvider.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
}

beforeEach(async () => {
  await resetData();
  const res = await request(app).post("/api/auth/register").send(registerBody);
  accessToken = res.body.accessToken;
  await auth(request(app).post("/api/internships/sync"));
});

afterAll(async () => {
  await resetData();
  await closeAutoApplyQueue();
  await prisma.$disconnect();
});

function auth(req: request.Test): request.Test {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

async function primeProfileForStrongMatches() {
  for (const skill of ["Go", "Python", "SQL", "Git", "REST APIs", "Docker", "Kubernetes", "JavaScript", "TypeScript", "React"]) {
    await auth(request(app).post("/api/profile/skills")).send({ name: skill, category: "LANGUAGE" });
  }
  await auth(request(app).patch("/api/profile")).send({ graduationYear: 2026 });
}

describe("GET/PATCH /api/auto-apply/rule", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/auto-apply/rule");
    expect(res.status).toBe(401);
  });

  it("defaults to disabled with manual approval required", async () => {
    const res = await auth(request(app).get("/api/auto-apply/rule"));
    expect(res.status).toBe(200);
    expect(res.body.isEnabled).toBe(false);
    expect(res.body.requireManualApproval).toBe(true);
  });

  it("updates the rule and persists the change", async () => {
    const res = await auth(request(app).patch("/api/auto-apply/rule")).send({
      isEnabled: true,
      minMatchScore: 50,
      maxApplicationsPerDay: 3,
      preferredRoles: ["Backend Developer"],
      excludedCompanies: ["Cascade Cloud"],
      requireManualApproval: false,
    });

    expect(res.status).toBe(200);
    expect(res.body.isEnabled).toBe(true);
    expect(res.body.minMatchScore).toBe(50);
    expect(res.body.excludedCompanies).toEqual(["Cascade Cloud"]);

    const refetched = await auth(request(app).get("/api/auto-apply/rule"));
    expect(refetched.body.isEnabled).toBe(true);
  });
});

describe("POST /api/auto-apply/run", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/auto-apply/run");
    expect(res.status).toBe(401);
  });

  it("queues nothing while the rule is disabled", async () => {
    await primeProfileForStrongMatches();
    const res = await auth(request(app).post("/api/auto-apply/run"));

    expect(res.status).toBe(200);
    expect(res.body.queued).toBe(0);
    expect(res.body.manualActionRequired).toBe(0);
    expect(res.body.evaluated).toBeGreaterThan(0);
    for (const evaluation of res.body.evaluations) {
      expect(evaluation.outcome).toBe("SKIPPED");
      const enabledCheck = evaluation.checks.find((c: { id: string }) => c.id === "AUTO_APPLY_ENABLED");
      expect(enabledCheck.passed).toBe(false);
    }
  });

  it("queues and auto-submits eligible internships when manual approval is off (mock provider always succeeds)", async () => {
    await primeProfileForStrongMatches();
    await auth(request(app).patch("/api/auto-apply/rule")).send({
      isEnabled: true,
      minMatchScore: 1,
      maxApplicationsPerDay: 50,
      requireManualApproval: false,
    });

    const res = await auth(request(app).post("/api/auto-apply/run"));
    expect(res.status).toBe(200);
    expect(res.body.queued).toBeGreaterThan(0);

    // Every internship's applicationUrl is on the mock provider's fabricated
    // domain, so every queued one should have a supported provider.
    const queuedEvaluations = res.body.evaluations.filter((e: { outcome: string }) => e.outcome === "QUEUED");
    expect(queuedEvaluations.length).toBe(res.body.queued);

    // The background worker isn't running in tests, so give the enqueued
    // jobs a moment — instead, assert queued applications were created and
    // are traceable; full worker processing is covered by autoApplyWorker.test.ts.
    const applications = await prisma.application.findMany({ where: { method: "AUTO" } });
    expect(applications.length).toBe(res.body.queued + res.body.manualActionRequired);
    expect(applications.every((a) => a.matchScore !== null)).toBe(true);
  });

  it("respects the daily application limit", async () => {
    await primeProfileForStrongMatches();
    await auth(request(app).patch("/api/auto-apply/rule")).send({
      isEnabled: true,
      minMatchScore: 1,
      maxApplicationsPerDay: 1,
      requireManualApproval: true,
    });

    const res = await auth(request(app).post("/api/auto-apply/run"));
    expect(res.status).toBe(200);
    expect(res.body.queued).toBeLessThanOrEqual(1);

    const dailyLimitFailures = res.body.evaluations.filter(
      (e: { checks: Array<{ id: string; passed: boolean }> }) =>
        e.checks.some((c) => c.id === "DAILY_LIMIT" && !c.passed),
    );
    if (res.body.queued === 1) {
      expect(dailyLimitFailures.length).toBeGreaterThan(0);
    }
  });

  it("skips excluded companies", async () => {
    await primeProfileForStrongMatches();
    await auth(request(app).patch("/api/auto-apply/rule")).send({
      isEnabled: true,
      minMatchScore: 1,
      maxApplicationsPerDay: 50,
      excludedCompanies: ["Northwind Systems"],
      requireManualApproval: true,
    });

    const res = await auth(request(app).post("/api/auto-apply/run"));
    const northwindEvaluations = res.body.evaluations.filter((e: { internship: { company: string } }) => e.internship.company === "Northwind Systems");
    expect(northwindEvaluations.length).toBeGreaterThan(0);
    for (const evaluation of northwindEvaluations) {
      expect(evaluation.outcome).toBe("SKIPPED");
    }
  });

  it("does not re-evaluate or duplicate an internship the student is already tracking", async () => {
    await primeProfileForStrongMatches();
    const list = await auth(request(app).get("/api/internships").query({ q: "Backend Developer" }));
    const internshipId = list.body.items[0].id;
    await auth(request(app).post("/api/applications")).send({ internshipId });

    await auth(request(app).patch("/api/auto-apply/rule")).send({ isEnabled: true, minMatchScore: 1, requireManualApproval: true });
    const res = await auth(request(app).post("/api/auto-apply/run"));

    const evaluation = res.body.evaluations.find((e: { internshipId: string }) => e.internshipId === internshipId);
    expect(evaluation.outcome).toBe("SKIPPED");
    const alreadyAppliedCheck = evaluation.checks.find((c: { id: string }) => c.id === "ALREADY_APPLIED");
    expect(alreadyAppliedCheck.passed).toBe(false);

    const count = await prisma.application.count({ where: { internshipId } });
    expect(count).toBe(1);
  });
});

describe("manual approval flow", () => {
  it("queues without submitting when manual approval is required, then submits on explicit approval", async () => {
    await primeProfileForStrongMatches();
    await auth(request(app).patch("/api/auto-apply/rule")).send({
      isEnabled: true,
      minMatchScore: 1,
      maxApplicationsPerDay: 50,
      requireManualApproval: true,
    });

    const run = await auth(request(app).post("/api/auto-apply/run"));
    const queuedEvaluation = run.body.evaluations.find((e: { outcome: string }) => e.outcome === "QUEUED");
    expect(queuedEvaluation).toBeTruthy();

    const application = await auth(request(app).get(`/api/applications/${queuedEvaluation.applicationId}`));
    expect(application.body.status).toBe("QUEUED");

    const approved = await auth(request(app).post(`/api/auto-apply/queue/${queuedEvaluation.applicationId}/approve`));
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("APPLIED");
    expect(approved.body.attempts.some((a: { method: string; status: string }) => a.method === "AUTO" && a.status === "APPLIED")).toBe(true);
  });
});

describe("GET /api/auto-apply/queue", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/auto-apply/queue");
    expect(res.status).toBe(401);
  });

  it("lists AUTO-method applications grouped by status", async () => {
    await primeProfileForStrongMatches();
    await auth(request(app).patch("/api/auto-apply/rule")).send({ isEnabled: true, minMatchScore: 1, requireManualApproval: true });
    await auth(request(app).post("/api/auto-apply/run"));

    const res = await auth(request(app).get("/api/auto-apply/queue"));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(Object.keys(res.body.countByStatus).length).toBeGreaterThan(0);
  });
});
