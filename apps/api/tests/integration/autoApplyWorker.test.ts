import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { enqueueSubmission, startAutoApplyWorker, closeAutoApplyQueue } from "../../src/jobs/autoApplyQueue.js";

/**
 * Proves the actual BullMQ Queue -> Worker -> submitQueuedApplication
 * plumbing works against real Redis, not just the business logic in
 * isolation (covered by autoApply.test.ts). The worker is started only
 * for this file and closed afterwards so it doesn't leak into other test
 * files or the running server.
 */
const app = createApp();

const registerBody = {
  email: "worker-applicant@example.com",
  password: "StrongPass1",
  fullName: "Ada Lovelace",
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

function waitFor(condition: () => Promise<boolean>, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await condition()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Timed out waiting for condition"));
      setTimeout(tick, 100);
    };
    void tick();
  });
}

describe("auto-apply background worker (real BullMQ + Redis)", () => {
  it("processes a queued application end to end via the worker", async () => {
    startAutoApplyWorker();

    for (const skill of ["Go", "Python", "SQL", "Git", "REST APIs"]) {
      await auth(request(app).post("/api/profile/skills")).send({ name: skill, category: "LANGUAGE" });
    }
    await auth(request(app).patch("/api/profile")).send({ graduationYear: 2026 });

    const list = await auth(request(app).get("/api/internships").query({ q: "Backend Developer" }));
    const internshipId = list.body.items[0].id;

    const application = await auth(request(app).post("/api/applications")).send({ internshipId });
    await auth(request(app).patch(`/api/applications/${application.body.id}/status`)).send({ status: "QUEUED" });

    const userId = (await prisma.user.findUniqueOrThrow({ where: { email: registerBody.email } })).id;
    await enqueueSubmission({ userId, applicationId: application.body.id });

    await waitFor(async () => {
      const current = await prisma.application.findUniqueOrThrow({ where: { id: application.body.id } });
      return current.status === "APPLIED";
    }, 15000);

    const final = await prisma.application.findUniqueOrThrow({
      where: { id: application.body.id },
      include: { attempts: true },
    });
    expect(final.status).toBe("APPLIED");
    expect(final.attempts.some((a) => a.method === "AUTO" && a.status === "APPLIED")).toBe(true);
  }, 20000);
});
