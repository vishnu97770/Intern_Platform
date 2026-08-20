import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const submit = vi.fn();

vi.mock("../../src/modules/auto-apply/providers/index.js", () => ({
  resolveApplicationProvider: () => ({ slug: "flaky-test-provider", supports: () => true, submit }),
}));

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { submitQueuedApplication } = await import("../../src/modules/auto-apply/autoApplyEngine.service.js");

const app = createApp();

const registerBody = {
  email: "flaky-applicant@example.com",
  password: "StrongPass1",
  fullName: "Grace Hopper",
};

let accessToken: string;

async function resetData() {
  await prisma.applicationAttempt.deleteMany();
  await prisma.application.deleteMany();
  await prisma.internshipSkill.deleteMany();
  await prisma.internship.deleteMany();
  await prisma.internshipProvider.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
}

beforeEach(async () => {
  submit.mockReset();
  await resetData();
  const res = await request(app).post("/api/auth/register").send(registerBody);
  accessToken = res.body.accessToken;
  await request(app).post("/api/internships/sync").set("Authorization", `Bearer ${accessToken}`);
});

afterAll(async () => {
  await resetData();
  await prisma.$disconnect();
});

describe("submitQueuedApplication error handling", () => {
  async function createQueuedApplication(): Promise<{ userId: string; applicationId: string }> {
    const list = await request(app)
      .get("/api/internships")
      .query({ pageSize: 1 })
      .set("Authorization", `Bearer ${accessToken}`);
    const internshipId = list.body.items[0].id;

    const created = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ internshipId });
    await request(app)
      .patch(`/api/applications/${created.body.id}/status`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "QUEUED" });

    const userId = (await prisma.user.findUniqueOrThrow({ where: { email: registerBody.email } })).id;
    return { userId, applicationId: created.body.id };
  }

  it("records a FAILED attempt and rethrows when the provider reports a failure result", async () => {
    submit.mockResolvedValue({ success: false, providerReference: null, failureReason: "Portal returned a validation error" });
    const { userId, applicationId } = await createQueuedApplication();

    const result = await submitQueuedApplication(userId, applicationId);
    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toBe("Portal returned a validation error");
    expect(result.attempts.at(-1)).toMatchObject({ method: "AUTO", status: "FAILED", failureReason: "Portal returned a validation error" });
  });

  it("records a FAILED attempt and rethrows when the provider throws (so BullMQ's retry policy applies)", async () => {
    submit.mockRejectedValue(new Error("Network timeout contacting provider"));
    const { userId, applicationId } = await createQueuedApplication();

    await expect(submitQueuedApplication(userId, applicationId)).rejects.toThrow("Network timeout contacting provider");

    const stored = await prisma.application.findUniqueOrThrow({ where: { id: applicationId }, include: { attempts: true } });
    expect(stored.status).toBe("FAILED");
    expect(stored.failureReason).toBe("Network timeout contacting provider");
    expect(stored.attempts.some((a) => a.method === "AUTO" && a.status === "FAILED")).toBe(true);
  });
});
