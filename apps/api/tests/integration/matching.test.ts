import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();

const registerBody = {
  email: "matcher@example.com",
  password: "StrongPass1",
  fullName: "Grace Hopper",
};

let accessToken: string;

async function resetData() {
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

describe("POST /api/matches/internships/:internshipId", () => {
  it("rejects unauthenticated requests", async () => {
    const id = await findInternshipIdByTitle(/Backend Developer/);
    const res = await request(app).post(`/api/matches/internships/${id}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown internship", async () => {
    const res = await auth(request(app).post("/api/matches/internships/00000000-0000-0000-0000-000000000000"));
    expect(res.status).toBe(404);
  });

  it("calculates a deterministic, explainable match score reflecting the student's profile", async () => {
    await auth(request(app).post("/api/profile/skills")).send({ name: "Go", category: "LANGUAGE" });
    await auth(request(app).post("/api/profile/skills")).send({ name: "Python", category: "LANGUAGE" });
    await auth(request(app).patch("/api/profile")).send({ graduationYear: 2026 });

    const id = await findInternshipIdByTitle(/Backend Developer/);
    const res = await auth(request(app).post(`/api/matches/internships/${id}`));

    expect(res.status).toBe(200);
    expect(res.body.internshipId).toBe(id);
    expect(res.body.overallScore).toBeGreaterThan(0);
    expect(res.body.overallScore).toBeLessThanOrEqual(100);
    expect(res.body.breakdown).toHaveProperty("skillMatch");
    expect(res.body.explanation.strongMatches).toEqual(expect.arrayContaining(["Go", "Python"]));
    expect(res.body.computedAt).toBeTruthy();
  });

  it("persists the result so a second GET returns the same cached score", async () => {
    await auth(request(app).post("/api/profile/skills")).send({ name: "Go", category: "LANGUAGE" });
    const id = await findInternshipIdByTitle(/Backend Developer/);

    const calculated = await auth(request(app).post(`/api/matches/internships/${id}`));
    const fetched = await auth(request(app).get(`/api/matches/internships/${id}`));

    expect(fetched.status).toBe(200);
    expect(fetched.body.overallScore).toBe(calculated.body.overallScore);
    expect(fetched.body.computedAt).toBe(calculated.body.computedAt);
  });
});

describe("GET /api/matches/internships/:internshipId", () => {
  it("computes and caches on first access even without an explicit calculate call", async () => {
    const id = await findInternshipIdByTitle(/Backend Developer/);
    const res = await auth(request(app).get(`/api/matches/internships/${id}`));
    expect(res.status).toBe(200);

    const stored = await prisma.matchResult.findFirst({ where: { internshipId: id } });
    expect(stored).not.toBeNull();
  });
});

describe("GET /api/matches/recommendations", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/matches/recommendations");
    expect(res.status).toBe(401);
  });

  it("returns internships ranked by descending match score", async () => {
    await auth(request(app).post("/api/profile/skills")).send({ name: "Go", category: "LANGUAGE" });
    await auth(request(app).post("/api/profile/skills")).send({ name: "Python", category: "LANGUAGE" });
    await auth(request(app).post("/api/profile/skills")).send({ name: "SQL", category: "LANGUAGE" });
    await auth(request(app).post("/api/profile/skills")).send({ name: "Git", category: "TOOL" });
    await auth(request(app).post("/api/profile/skills")).send({ name: "REST APIs", category: "TOOL" });
    await auth(request(app).patch("/api/profile")).send({ graduationYear: 2026, preferredRoles: ["Backend Developer"] });

    const res = await auth(request(app).get("/api/matches/recommendations").query({ pageSize: 20 }));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);

    const scores = res.body.items.map((i: { overallScore: number }) => i.overallScore);
    expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));

    const top = res.body.items[0];
    expect(top.internship).toHaveProperty("title");
    expect(top.internship.title).toMatch(/Backend Developer/);
  });

  it("filters by a minimum score", async () => {
    const res = await auth(request(app).get("/api/matches/recommendations").query({ minScore: 90, pageSize: 20 }));
    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.overallScore).toBeGreaterThanOrEqual(90);
    }
  });
});
