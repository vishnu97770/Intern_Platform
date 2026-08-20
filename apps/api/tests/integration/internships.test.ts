import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();

const registerBody = {
  email: "internship-browser@example.com",
  password: "StrongPass1",
  fullName: "Grace Hopper",
};

let accessToken: string;

async function resetInternshipData() {
  await prisma.internshipSkill.deleteMany();
  await prisma.internship.deleteMany();
  await prisma.internshipProvider.deleteMany();
}

beforeEach(async () => {
  await resetInternshipData();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  const res = await request(app).post("/api/auth/register").send(registerBody);
  accessToken = res.body.accessToken;
});

afterAll(async () => {
  await resetInternshipData();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.$disconnect();
});

function auth(req: request.Test): request.Test {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

describe("POST /api/internships/sync", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/internships/sync");
    expect(res.status).toBe(401);
  });

  it("ingests every seed listing from the mock provider", async () => {
    const res = await auth(request(app).post("/api/internships/sync"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].provider).toBe("mock-seed");
    expect(res.body[0].fetched).toBeGreaterThan(0);
    expect(res.body[0].created).toBe(res.body[0].fetched);
    expect(res.body[0].errors).toEqual([]);

    const providerRow = await prisma.internshipProvider.findUnique({ where: { slug: "mock-seed" } });
    expect(providerRow).not.toBeNull();

    const count = await prisma.internship.count();
    expect(count).toBe(res.body[0].fetched);
  });

  it("is idempotent: syncing twice updates existing rows instead of duplicating them (provider + externalId dedup)", async () => {
    const first = await auth(request(app).post("/api/internships/sync"));
    const totalAfterFirst = await prisma.internship.count();

    const second = await auth(request(app).post("/api/internships/sync"));
    const totalAfterSecond = await prisma.internship.count();

    expect(totalAfterSecond).toBe(totalAfterFirst);
    expect(second.body[0].created).toBe(0);
    expect(second.body[0].updated).toBe(first.body[0].fetched);
  });
});

describe("GET /api/internships", () => {
  beforeEach(async () => {
    await auth(request(app).post("/api/internships/sync"));
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/internships");
    expect(res.status).toBe(401);
  });

  it("returns a paginated list with skills attached", async () => {
    const res = await auth(request(app).get("/api/internships").query({ pageSize: 5 }));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(5);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(5);
    expect(res.body.total).toBeGreaterThan(5);
    expect(res.body.items[0]).toHaveProperty("requiredSkills");
    expect(res.body.items[0]).toHaveProperty("source", "Seed Internships (Mock Provider)");
  });

  it("filters by search text on title/company", async () => {
    const res = await auth(request(app).get("/api/internships").query({ q: "Backend" }));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i: { title: string }) => /backend/i.test(i.title))).toBe(true);
  });

  it("filters by required skill", async () => {
    const res = await auth(request(app).get("/api/internships").query({ skill: "Kubernetes" }));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect([...item.requiredSkills, ...item.preferredSkills]).toContain("Kubernetes");
    }
  });

  it("filters by work mode", async () => {
    const res = await auth(request(app).get("/api/internships").query({ workMode: "REMOTE" }));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i: { workMode: string }) => i.workMode === "REMOTE")).toBe(true);
  });

  it("sorts by soonest deadline", async () => {
    const res = await auth(request(app).get("/api/internships").query({ sortBy: "deadline", pageSize: 50 }));
    const deadlines = res.body.items.map((i: { applicationDeadline: string }) => i.applicationDeadline);
    const sorted = [...deadlines].sort();
    expect(deadlines).toEqual(sorted);
  });

  it("rejects an invalid query parameter", async () => {
    const res = await auth(request(app).get("/api/internships").query({ workMode: "FROM_HOME" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/internships/:id", () => {
  it("returns full detail including description and eligibility fields", async () => {
    await auth(request(app).post("/api/internships/sync"));
    const list = await auth(request(app).get("/api/internships").query({ q: "Backend Developer" }));
    const id = list.body.items[0].id;

    const res = await auth(request(app).get(`/api/internships/${id}`));
    expect(res.status).toBe(200);
    expect(res.body.description).toContain("logistics");
    expect(res.body.minGraduationYear).not.toBeNull();
    expect(res.body.requiredSkills.length).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await auth(request(app).get("/api/internships/00000000-0000-0000-0000-000000000000"));
    expect(res.status).toBe(404);
  });
});
