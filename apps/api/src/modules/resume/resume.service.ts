import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ConfirmResumeInput, ParsedResume, ResumeDetailDTO, ResumeDTO, StudentProfileDTO } from "@intern-platform/shared";
import { Prisma } from "@prisma/client";
import type { Resume } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { storageProvider } from "../../lib/storage/index.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import * as profileService from "../profile/profile.service.js";
import { DeterministicResumeParser } from "./parsers/deterministicResumeParser.js";

/** Swappable — see packages/shared ResumeParser. A hosted/AI parser can replace or augment this later. */
const resumeParser = new DeterministicResumeParser();

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function toDTO(resume: Resume): ResumeDTO {
  return {
    id: resume.id,
    fileName: resume.fileName,
    mimeType: resume.mimeType,
    fileSizeBytes: resume.fileSizeBytes,
    status: resume.status,
    parserName: resume.parserName,
    confidence: resume.confidence,
    failureReason: resume.failureReason,
    confirmedAt: resume.confirmedAt ? resume.confirmedAt.toISOString() : null,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
}

function toDetailDTO(resume: Resume): ResumeDetailDTO {
  return { ...toDTO(resume), parsedData: (resume.parsedData as unknown as ParsedResume | null) ?? null };
}

async function requireProfileId(userId: string): Promise<string> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError("Student profile not found");
  return profile.id;
}

async function requireOwnedResume(profileId: string, resumeId: string): Promise<Resume> {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, studentProfileId: profileId } });
  if (!resume) throw new NotFoundError("Resume not found");
  return resume;
}

export async function uploadResume(userId: string, file: UploadedFile): Promise<ResumeDetailDTO> {
  const profileId = await requireProfileId(userId);

  if (!resumeParser.supports(file.mimetype)) {
    throw new ValidationError("Unsupported file type. Only PDF and DOCX resumes are accepted.");
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const storageKey = `resumes/${userId}/${randomUUID()}${ext}`;
  await storageProvider.save(storageKey, file.buffer);

  let resume = await prisma.resume.create({
    data: {
      studentProfileId: profileId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      storageKey,
      status: "UPLOADED",
    },
  });

  try {
    const parsed = await resumeParser.parse(file.buffer, file.mimetype);
    resume = await prisma.resume.update({
      where: { id: resume.id },
      data: {
        status: "PARSED",
        rawText: parsed.rawText,
        parsedData: parsed as unknown as Prisma.InputJsonValue,
        parserName: resumeParser.name,
        confidence: parsed.confidence,
      },
    });
  } catch (err) {
    // Never log resume contents — only the failure reason.
    logger.warn({ resumeId: resume.id, err: err instanceof Error ? err.message : "unknown error" }, "Resume parsing failed");
    resume = await prisma.resume.update({
      where: { id: resume.id },
      data: {
        status: "FAILED",
        failureReason: err instanceof Error ? err.message : "Parsing failed",
      },
    });
  }

  return toDetailDTO(resume);
}

export async function listResumes(userId: string): Promise<ResumeDTO[]> {
  const profileId = await requireProfileId(userId);
  const resumes = await prisma.resume.findMany({
    where: { studentProfileId: profileId },
    orderBy: { createdAt: "desc" },
  });
  return resumes.map(toDTO);
}

export async function getResume(userId: string, resumeId: string): Promise<ResumeDetailDTO> {
  const profileId = await requireProfileId(userId);
  const resume = await requireOwnedResume(profileId, resumeId);
  return toDetailDTO(resume);
}

export async function getResumeFile(userId: string, resumeId: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const profileId = await requireProfileId(userId);
  const resume = await requireOwnedResume(profileId, resumeId);
  const buffer = await storageProvider.read(resume.storageKey);
  return { buffer, mimeType: resume.mimeType, fileName: resume.fileName };
}

export async function confirmResume(
  userId: string,
  resumeId: string,
  input: ConfirmResumeInput,
): Promise<{ resume: ResumeDetailDTO; profile: StudentProfileDTO }> {
  const profileId = await requireProfileId(userId);
  const resume = await requireOwnedResume(profileId, resumeId);

  if (resume.status === "FAILED" || resume.status === "UPLOADED") {
    throw new ValidationError("This resume has no parsed data to confirm yet.");
  }

  // Every change below is exactly what the student reviewed and approved —
  // nothing here is inferred or applied automatically.
  if (input.profile && Object.keys(input.profile).length > 0) {
    await profileService.updateProfile(userId, input.profile);
  }
  for (const skill of input.skills ?? []) {
    await profileService.addSkill(userId, skill);
  }
  for (const project of input.projects ?? []) {
    await profileService.addProject(userId, project);
  }
  for (const experience of input.experience ?? []) {
    await profileService.addExperience(userId, experience);
  }
  for (const certification of input.certifications ?? []) {
    await profileService.addCertification(userId, certification);
  }

  const updatedResume = await prisma.resume.update({
    where: { id: resume.id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  const profile = await profileService.getProfile(userId);

  return { resume: toDetailDTO(updatedResume), profile };
}

export async function deleteResume(userId: string, resumeId: string): Promise<void> {
  const profileId = await requireProfileId(userId);
  const resume = await requireOwnedResume(profileId, resumeId);

  try {
    await storageProvider.delete(resume.storageKey);
  } catch (err) {
    logger.warn({ resumeId: resume.id, err: err instanceof Error ? err.message : "unknown error" }, "Failed to delete resume file from storage");
  }

  await prisma.resume.delete({ where: { id: resume.id } });
}
