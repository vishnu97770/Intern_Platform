import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();

const registerBody = {
  email: "applicant@example.com",
  password: "StrongPass1",
  fullName: "Grace Hopper",
};

let accessToken: string;

async function resetData() {
  await prisma.applicationAttempt.deleteMany();
  await prisma.application.deleteMany();
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
  await prisma.$disconnect();
});

function auth(req: request.Test): request.Test {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

async function findInternshipIdByTitle(title: RegExp): Promise<string> {
  const list = await auth(request(app).get("/api/internships").query({ pageSize: 50 }));
  const match = list.body.items.find((i: { title: string }) => title.test(i.title));
  if (!match) throw new Error(`No seed internship matched ${title}`);
  return match.id;
}

describe("POST /api/applications", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/applications").send({ internshipId: "x" });
    expect(res.status).toBe(401);
  });

  it("tracks a new application with status DISCOVERED and the internship's application URL", async () => {
    const internshipId = await findInternshipIdByTitle(/Backend Developer/);
    const res = await auth(request(app).post("/api/applications")).send({ internshipId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("DISCOVERED");
    expect(res.body.method).toBe("MANUAL");
    expect(res.body.internship.id).toBe(internshipId);
    expect(res.body.applicationUrl).toBeTruthy();
    expect(res.body.attempts).toEqual([]);
  });

  it("captures the cached match score at creation time, when one exists", async () => {
    const internshipId = await findInternshipIdByTitle(/Backend Developer/);
    await auth(request(app).post(`/api/matches/internships/${internshipId}`));

    const res = await auth(request(app).post("/api/applications")).send({ internshipId });
    expect(res.status).toBe(201);
    expect(typeof res.body.matchScore).toBe("number");
  });

  it("prevents duplicate tracking of the same internship (provider + external job id is transitively unique via Internship)", async () => {
    const internshipId = await findInternshipIdByTitle(/Backend Developer/);
    const first = await auth(request(app).post("/api/applications")).send({ internshipId });
    expect(first.status).toBe(201);

    const second = await auth(request(app).post("/api/applications")).send({ internshipId });
    expect(second.status).toBe(409);
  });

  it("returns 404 for an unknown internship", async () => {
    const res = await auth(request(app).post("/api/applications")).send({ internshipId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/applications/:id/status", () => {
  async function createTrackedApplication(): Promise<string> {
    const internshipId = await findInternshipIdByTitle(/Backend Developer/);
    const res = await auth(request(app).post("/api/applications")).send({ internshipId });
    return res.body.id;
  }

  it("marking APPLIED sets appliedAt and records an attempt", async () => {
    const id = await createTrackedApplication();
    const res = await auth(request(app).patch(`/api/applications/${id}/status`)).send({ status: "APPLIED" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPLIED");
    expect(res.body.appliedAt).not.toBeNull();
    expect(res.body.attempts).toHaveLength(1);
    expect(res.body.attempts[0]).toMatchObject({ attemptNumber: 1, method: "MANUAL", status: "APPLIED" });
  });

  it("marking FAILED records the failure reason on both the application and the attempt", async () => {
    const id = await createTrackedApplication();
    const res = await auth(request(app).patch(`/api/applications/${id}/status`)).send({
      status: "FAILED",
      failureReason: "Application portal rejected the resume format",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FAILED");
    expect(res.body.failureReason).toBe("Application portal rejected the resume format");
    expect(res.body.attempts[0].failureReason).toBe("Application portal rejected the resume format");
  });

  it("appends a second attempt on a subsequent status change instead of overwriting the first", async () => {
    const id = await createTrackedApplication();
    await auth(request(app).patch(`/api/applications/${id}/status`)).send({ status: "APPLIED" });
    const res = await auth(request(app).patch(`/api/applications/${id}/status`)).send({ status: "INTERVIEW" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("INTERVIEW");
    expect(res.body.attempts).toHaveLength(2);
    expect(res.body.attempts.map((a: { attemptNumber: number }) => a.attemptNumber)).toEqual([1, 2]);
  });

  it("rejects an invalid status value", async () => {
    const id = await createTrackedApplication();
    const res = await auth(request(app).patch(`/api/applications/${id}/status`)).send({ status: "NOT_A_STATUS" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for another student's application", async () => {
    const id = await createTrackedApplication();
    const other = await request(app)
      .post("/api/auth/register")
      .send({ email: "other-applicant@example.com", password: "StrongPass1", fullName: "Other Student" });

    const res = await request(app)
      .patch(`/api/applications/${id}/status`)
      .set("Authorization", `Bearer ${other.body.accessToken}`)
      .send({ status: "APPLIED" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/applications", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/applications");
    expect(res.status).toBe(401);
  });

  it("lists only the current student's applications, filterable by status", async () => {
    const backendId = await findInternshipIdByTitle(/Backend Developer/);
    const frontendId = await findInternshipIdByTitle(/Frontend Developer/);

    const backendApp = await auth(request(app).post("/api/applications")).send({ internshipId: backendId });
    await auth(request(app).post("/api/applications")).send({ internshipId: frontendId });
    await auth(request(app).patch(`/api/applications/${backendApp.body.id}/status`)).send({ status: "APPLIED" });

    const all = await auth(request(app).get("/api/applications"));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);

    const appliedOnly = await auth(request(app).get("/api/applications").query({ status: "APPLIED" }));
    expect(appliedOnly.body.items).toHaveLength(1);
    expect(appliedOnly.body.items[0].status).toBe("APPLIED");
  });

  it("supports comma-separated multi-status filters", async () => {
    const backendId = await findInternshipIdByTitle(/Backend Developer/);
    const frontendId = await findInternshipIdByTitle(/Frontend Developer/);
    const backendApp = await auth(request(app).post("/api/applications")).send({ internshipId: backendId });
    const frontendApp = await auth(request(app).post("/api/applications")).send({ internshipId: frontendId });
    await auth(request(app).patch(`/api/applications/${backendApp.body.id}/status`)).send({ status: "APPLIED" });
    await auth(request(app).patch(`/api/applications/${frontendApp.body.id}/status`)).send({ status: "REJECTED" });

    const res = await auth(request(app).get("/api/applications").query({ status: "APPLIED,REJECTED" }));
    expect(res.body.items).toHaveLength(2);
  });
});

describe("DELETE /api/applications/:id", () => {
  it("removes a tracked application", async () => {
    const internshipId = await findInternshipIdByTitle(/Backend Developer/);
    const created = await auth(request(app).post("/api/applications")).send({ internshipId });

    const res = await auth(request(app).delete(`/api/applications/${created.body.id}`));
    expect(res.status).toBe(204);

    const list = await auth(request(app).get("/api/applications"));
    expect(list.body.total).toBe(0);
  });
});
