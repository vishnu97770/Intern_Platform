import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();

const registerBody = {
  email: "profile-student@example.com",
  password: "StrongPass1",
  fullName: "Grace Hopper",
};

let accessToken: string;

beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  const res = await request(app).post("/api/auth/register").send(registerBody);
  accessToken = res.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.$disconnect();
});

function auth(req: request.Test): request.Test {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

describe("GET /api/profile", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/profile");
    expect(res.status).toBe(401);
  });

  it("returns the newly created profile seeded from registration", async () => {
    const res = await auth(request(app).get("/api/profile"));
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe(registerBody.fullName);
    expect(res.body.skills).toEqual([]);
    expect(res.body.projects).toEqual([]);
    expect(res.body.workModePreference).toBe("ANY");
  });
});

describe("PATCH /api/profile", () => {
  it("updates core profile fields", async () => {
    const res = await auth(request(app).patch("/api/profile")).send({
      college: "MIT",
      graduationYear: 2027,
      cgpa: 9.1,
      preferredRoles: ["Backend Developer", "DevOps"],
      workModePreference: "REMOTE",
    });

    expect(res.status).toBe(200);
    expect(res.body.college).toBe("MIT");
    expect(res.body.graduationYear).toBe(2027);
    expect(res.body.cgpa).toBe(9.1);
    expect(res.body.preferredRoles).toEqual(["Backend Developer", "DevOps"]);
    expect(res.body.workModePreference).toBe("REMOTE");
  });

  it("rejects an invalid cgpa", async () => {
    const res = await auth(request(app).patch("/api/profile")).send({ cgpa: 15 });
    expect(res.status).toBe(400);
  });
});

describe("skills", () => {
  it("adds a skill and is idempotent on re-adding the same name", async () => {
    const first = await auth(request(app).post("/api/profile/skills")).send({
      name: "Python",
      category: "LANGUAGE",
      proficiency: 4,
    });
    expect(first.status).toBe(201);
    expect(first.body.skills).toHaveLength(1);
    expect(first.body.skills[0].name).toBe("Python");

    const second = await auth(request(app).post("/api/profile/skills")).send({
      name: "Python",
      category: "LANGUAGE",
      proficiency: 5,
    });
    expect(second.status).toBe(201);
    expect(second.body.skills).toHaveLength(1);
    expect(second.body.skills[0].proficiency).toBe(5);
  });

  it("removes a skill", async () => {
    const added = await auth(request(app).post("/api/profile/skills")).send({ name: "Go", category: "LANGUAGE" });
    const skillId = added.body.skills[0].id;

    const removed = await auth(request(app).delete(`/api/profile/skills/${skillId}`));
    expect(removed.status).toBe(200);
    expect(removed.body.skills).toEqual([]);
  });
});

describe("projects", () => {
  it("adds and deletes a project", async () => {
    const added = await auth(request(app).post("/api/profile/projects")).send({
      title: "Resume Matcher",
      techStack: ["TypeScript", "Postgres"],
    });
    expect(added.status).toBe(201);
    expect(added.body.projects).toHaveLength(1);

    const projectId = added.body.projects[0].id;
    const deleted = await auth(request(app).delete(`/api/profile/projects/${projectId}`));
    expect(deleted.status).toBe(200);
    expect(deleted.body.projects).toEqual([]);
  });
});

describe("experience", () => {
  it("adds and deletes an experience entry", async () => {
    const added = await auth(request(app).post("/api/profile/experience")).send({
      title: "SWE Intern",
      organization: "Acme Corp",
      startDate: "2025-06-01T00:00:00.000Z",
      isCurrent: false,
      endDate: "2025-08-01T00:00:00.000Z",
    });
    expect(added.status).toBe(201);
    expect(added.body.experience).toHaveLength(1);

    const experienceId = added.body.experience[0].id;
    const deleted = await auth(request(app).delete(`/api/profile/experience/${experienceId}`));
    expect(deleted.status).toBe(200);
    expect(deleted.body.experience).toEqual([]);
  });

  it("rejects a missing required startDate", async () => {
    const res = await auth(request(app).post("/api/profile/experience")).send({
      title: "SWE Intern",
      organization: "Acme Corp",
    });
    expect(res.status).toBe(400);
  });
});

describe("certifications", () => {
  it("adds and deletes a certification", async () => {
    const added = await auth(request(app).post("/api/profile/certifications")).send({
      name: "AWS Certified Cloud Practitioner",
      issuer: "AWS",
    });
    expect(added.status).toBe(201);
    expect(added.body.certifications).toHaveLength(1);

    const certificationId = added.body.certifications[0].id;
    const deleted = await auth(request(app).delete(`/api/profile/certifications/${certificationId}`));
    expect(deleted.status).toBe(200);
    expect(deleted.body.certifications).toEqual([]);
  });
});
