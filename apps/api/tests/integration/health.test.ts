import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { closeHealthRedisClient } from "../../src/modules/health/health.service.js";

const app = createApp();

afterAll(async () => {
  await closeHealthRedisClient();
});

describe("GET /api/health", () => {
  it("reports ok with real database and redis connectivity checks", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "ok", redis: "ok" });
  });

  it("does not require authentication", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).not.toBe(401);
  });
});
