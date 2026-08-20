import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();

function extractRefreshCookie(res: request.Response): string {
  const cookie = res.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("Expected a Set-Cookie header on the response");
  return cookie;
}

const validRegisterBody = {
  email: "student@example.com",
  password: "StrongPass1",
  fullName: "Ada Lovelace",
};

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates a user and returns an access token + refresh cookie", async () => {
    const res = await request(app).post("/api/auth/register").send(validRegisterBody);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(validRegisterBody.email);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.accessToken.length).toBeGreaterThan(10);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/refresh_token=/);

    const profile = await prisma.studentProfile.findFirst({ where: { user: { email: validRegisterBody.email } } });
    expect(profile?.fullName).toBe(validRegisterBody.fullName);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/api/auth/register").send(validRegisterBody);
    const res = await request(app).post("/api/auth/register").send(validRegisterBody);
    expect(res.status).toBe(409);
  });

  it("rejects a weak password with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, password: "weak" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegisterBody, email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(validRegisterBody);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validRegisterBody.email, password: validRegisterBody.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validRegisterBody.email);
  });

  it("rejects an incorrect password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validRegisterBody.email, password: "WrongPass1" });
    expect(res.status).toBe(401);
  });

  it("rejects a non-existent email with 401 (no account enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "WrongPass1" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh + logout", () => {
  it("issues a new access token from the refresh cookie and rotates it", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(validRegisterBody);
    const cookie = extractRefreshCookie(registerRes);

    const refreshRes = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).not.toBe(registerRes.body.accessToken);

    // The original (now-rotated) refresh cookie must no longer work.
    const reuseRes = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(reuseRes.status).toBe(401);
  });

  it("rejects refresh with no cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("invalidates the refresh token on logout", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(validRegisterBody);
    const cookie = extractRefreshCookie(registerRes);

    const logoutRes = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post("/api/auth/refresh").set("Cookie", cookie);
    expect(refreshRes.status).toBe(401);
  });
});
