import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();

async function resetUsers() {
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

beforeEach(resetUsers);
afterAll(async () => {
  await resetUsers();
  await prisma.$disconnect();
});

describe("security headers", () => {
  it("sets standard hardening headers (helmet) and hides the framework fingerprint", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("reflects the configured origin with credentials support for CORS", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("malformed request handling", () => {
  it("returns a clean 400 instead of a 500 for invalid JSON in the request body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not valid json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("cross-user authorization on newer Phase 5/6 endpoints", () => {
  async function registerUser(email: string): Promise<string> {
    const res = await request(app).post("/api/auth/register").send({ email, password: "StrongPass1", fullName: "Test Student" });
    return res.body.accessToken as string;
  }

  it("never returns another student's auto-apply queue items", async () => {
    const tokenA = await registerUser("queue-owner@example.com");
    const tokenB = await registerUser("queue-outsider@example.com");

    const queueA = await request(app).get("/api/auto-apply/queue").set("Authorization", `Bearer ${tokenA}`);
    const queueB = await request(app).get("/api/auto-apply/queue").set("Authorization", `Bearer ${tokenB}`);

    expect(queueA.status).toBe(200);
    expect(queueB.status).toBe(200);
    expect(queueA.body.items).toEqual([]);
    expect(queueB.body.items).toEqual([]);
  });

  it("rejects approving an application that belongs to a different student", async () => {
    const tokenA = await registerUser("approve-owner@example.com");
    const tokenB = await registerUser("approve-outsider@example.com");

    await request(app).post("/api/internships/sync").set("Authorization", `Bearer ${tokenA}`);
    const list = await request(app).get("/api/internships").query({ pageSize: 1 }).set("Authorization", `Bearer ${tokenA}`);
    const internshipId = list.body.items[0].id;

    const created = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ internshipId });
    await request(app)
      .patch(`/api/applications/${created.body.id}/status`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "QUEUED" });

    const res = await request(app)
      .post(`/api/auto-apply/queue/${created.body.id}/approve`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});

// Deliberately last: this exhausts authRateLimiter's shared, IP-keyed quota
// for the rest of the test run, so no test needing a working
// register/login can run after it.
describe("auth rate limiting", () => {
  it("throttles repeated login attempts from the same client", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 25 }, () =>
        request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "WrongPass1" }),
      ),
    );
    expect(attempts.some((res) => res.status === 429)).toBe(true);
  });
}, 20000);
