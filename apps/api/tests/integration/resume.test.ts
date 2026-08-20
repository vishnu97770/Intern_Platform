import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Document, Packer, Paragraph } from "docx";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();

const registerBody = {
  email: "resume-student@example.com",
  password: "StrongPass1",
  fullName: "Ada Lovelace",
};

let accessToken: string;

async function buildSampleDocx(): Promise<Buffer> {
  const lines = [
    "Ada Lovelace",
    "ada.lovelace@example.com",
    "+1 212-555-0199",
    "",
    "EDUCATION",
    "B.Tech in Computer Science, Example Institute of Technology",
    "CGPA: 8.7/10",
    "2022 - 2026",
    "",
    "SKILLS",
    "Python, TypeScript, React, PostgreSQL, Docker",
    "",
    "PROJECTS",
    "Analytical Engine Simulator - Simulates a mechanical computer.",
    "Tech Stack: Python, PostgreSQL",
    "",
    "CERTIFICATIONS",
    "AWS Certified Cloud Practitioner - AWS",
  ];
  const doc = new Document({
    sections: [{ children: lines.map((line) => new Paragraph(line)) }],
  });
  return Packer.toBuffer(doc);
}

beforeEach(async () => {
  await prisma.resume.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  const res = await request(app).post("/api/auth/register").send(registerBody);
  accessToken = res.body.accessToken;
});

afterAll(async () => {
  await prisma.resume.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.$disconnect();
});

function auth(req: request.Test): request.Test {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

describe("POST /api/resume/upload", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post("/api/resume/upload");
    expect(res.status).toBe(401);
  });

  it("rejects an unsupported file type", async () => {
    const res = await auth(request(app).post("/api/resume/upload")).attach(
      "resume",
      Buffer.from("not a resume"),
      { filename: "resume.txt", contentType: "text/plain" },
    );
    expect(res.status).toBe(400);
  });

  it("rejects a file over the size limit", async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, "a");
    const res = await auth(request(app).post("/api/resume/upload")).attach("resume", big, {
      filename: "resume.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(400);
  });

  it("accepts a DOCX resume, extracts text, and proposes structured data without touching the profile", async () => {
    const buffer = await buildSampleDocx();
    const res = await auth(request(app).post("/api/resume/upload")).attach("resume", buffer, {
      filename: "resume.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PARSED");
    expect(res.body.parsedData.email).toBe("ada.lovelace@example.com");
    expect(res.body.parsedData.degree).toBe("B.Tech");
    expect(res.body.parsedData.skills.map((s: { name: string }) => s.name)).toEqual(
      expect.arrayContaining(["Python", "TypeScript", "React"]),
    );

    // Profile must be untouched until the student explicitly confirms.
    const profile = await auth(request(app).get("/api/profile"));
    expect(profile.body.fullName).toBe(registerBody.fullName);
    expect(profile.body.college).toBeNull();
    expect(profile.body.skills).toEqual([]);
  });
});

describe("resume review + confirm workflow", () => {
  async function upload(): Promise<{ id: string; parsedData: { skills: Array<{ name: string; category: string }> } }> {
    const buffer = await buildSampleDocx();
    const res = await auth(request(app).post("/api/resume/upload")).attach("resume", buffer, {
      filename: "resume.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    return res.body;
  }

  it("lists and fetches a resume by id, scoped to its owner", async () => {
    const uploaded = await upload();

    const list = await auth(request(app).get("/api/resume"));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const detail = await auth(request(app).get(`/api/resume/${uploaded.id}`));
    expect(detail.status).toBe(200);
    expect(detail.body.parsedData.degree).toBe("B.Tech");
  });

  it("returns 404 for a resume belonging to another user", async () => {
    const uploaded = await upload();

    const other = await request(app)
      .post("/api/auth/register")
      .send({ email: "someone-else@example.com", password: "StrongPass1", fullName: "Other Student" });
    const otherToken = other.body.accessToken as string;

    const res = await request(app)
      .get(`/api/resume/${uploaded.id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it("applies only the student-approved fields to the profile on confirm, and marks the resume CONFIRMED", async () => {
    const uploaded = await upload();

    const confirmRes = await auth(request(app).post(`/api/resume/${uploaded.id}/confirm`)).send({
      profile: { college: "Example Institute of Technology", cgpa: 8.7, graduationYear: 2026 },
      skills: uploaded.parsedData.skills.map((s) => ({ name: s.name, category: s.category })),
    });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.resume.status).toBe("CONFIRMED");
    expect(confirmRes.body.resume.confirmedAt).not.toBeNull();
    expect(confirmRes.body.profile.college).toBe("Example Institute of Technology");
    expect(confirmRes.body.profile.cgpa).toBe(8.7);
    expect(confirmRes.body.profile.skills.map((s: { name: string }) => s.name)).toEqual(
      expect.arrayContaining(["Python", "TypeScript", "React"]),
    );

    // fullName was never included in the confirm payload, so it must be unchanged.
    expect(confirmRes.body.profile.fullName).toBe(registerBody.fullName);
  });

  it("rejects confirming a resume that has no parsed data yet", async () => {
    const profile = await prisma.studentProfile.findFirstOrThrow();
    const resume = await prisma.resume.create({
      data: {
        studentProfileId: profile.id,
        fileName: "broken.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 10,
        storageKey: "resumes/does-not-matter.pdf",
        status: "FAILED",
        failureReason: "corrupt file",
      },
    });

    const res = await auth(request(app).post(`/api/resume/${resume.id}/confirm`)).send({});
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/resume/:id", () => {
  it("deletes a resume", async () => {
    const buffer = await buildSampleDocx();
    const uploaded = await auth(request(app).post("/api/resume/upload")).attach("resume", buffer, {
      filename: "resume.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const res = await auth(request(app).delete(`/api/resume/${uploaded.body.id}`));
    expect(res.status).toBe(204);

    const list = await auth(request(app).get("/api/resume"));
    expect(list.body).toEqual([]);
  });
});
