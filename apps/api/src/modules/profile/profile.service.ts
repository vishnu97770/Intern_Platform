import type {
  StudentProfileDTO,
  ProjectDTO,
  ExperienceDTO,
  CertificationDTO,
  StudentSkillDTO,
} from "@intern-platform/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError } from "../../lib/errors.js";
import type { UpdateProfileBody, AddSkillBody, ProjectBody, ExperienceBody, CertificationBody } from "./profile.validators.js";

const profileInclude = {
  skills: { include: { skill: true } },
  projects: true,
  experience: true,
  certifications: true,
} satisfies Prisma.StudentProfileInclude;

type ProfileWithRelations = Prisma.StudentProfileGetPayload<{ include: typeof profileInclude }>;

function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function toDTO(profile: ProfileWithRelations): StudentProfileDTO {
  const skills: StudentSkillDTO[] = profile.skills.map((s) => ({
    id: s.skill.id,
    name: s.skill.name,
    category: s.skill.category,
    proficiency: s.proficiency,
  }));

  const projects: ProjectDTO[] = profile.projects.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    techStack: p.techStack,
    url: p.url,
    startDate: toDateStr(p.startDate),
    endDate: toDateStr(p.endDate),
  }));

  const experience: ExperienceDTO[] = profile.experience.map((e) => ({
    id: e.id,
    title: e.title,
    organization: e.organization,
    description: e.description,
    startDate: e.startDate.toISOString(),
    endDate: toDateStr(e.endDate),
    isCurrent: e.isCurrent,
  }));

  const certifications: CertificationDTO[] = profile.certifications.map((c) => ({
    id: c.id,
    name: c.name,
    issuer: c.issuer,
    issueDate: toDateStr(c.issueDate),
    url: c.url,
  }));

  return {
    id: profile.id,
    userId: profile.userId,
    fullName: profile.fullName,
    phone: profile.phone,
    location: profile.location,
    college: profile.college,
    degree: profile.degree,
    branch: profile.branch,
    graduationYear: profile.graduationYear,
    cgpa: profile.cgpa,
    bio: profile.bio,
    githubUrl: profile.githubUrl,
    linkedinUrl: profile.linkedinUrl,
    portfolioUrl: profile.portfolioUrl,
    preferredRoles: profile.preferredRoles,
    preferredLocations: profile.preferredLocations,
    workModePreference: profile.workModePreference,
    skills,
    projects,
    experience,
    certifications,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

async function requireProfileId(userId: string): Promise<string> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError("Student profile not found");
  return profile.id;
}

export async function getProfile(userId: string): Promise<StudentProfileDTO> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, include: profileInclude });
  if (!profile) throw new NotFoundError("Student profile not found");
  return toDTO(profile);
}

export async function updateProfile(userId: string, input: UpdateProfileBody): Promise<StudentProfileDTO> {
  await requireProfileId(userId);
  const profile = await prisma.studentProfile.update({
    where: { userId },
    data: input,
    include: profileInclude,
  });
  return toDTO(profile);
}

export async function addSkill(userId: string, input: AddSkillBody): Promise<StudentProfileDTO> {
  const profileId = await requireProfileId(userId);

  const skill = await prisma.skill.upsert({
    where: { name: input.name },
    create: { name: input.name, category: input.category },
    update: {},
  });

  await prisma.studentSkill.upsert({
    where: { studentProfileId_skillId: { studentProfileId: profileId, skillId: skill.id } },
    create: { studentProfileId: profileId, skillId: skill.id, proficiency: input.proficiency ?? null },
    update: { proficiency: input.proficiency ?? null },
  });

  return getProfile(userId);
}

export async function removeSkill(userId: string, skillId: string): Promise<StudentProfileDTO> {
  const profileId = await requireProfileId(userId);
  await prisma.studentSkill.deleteMany({ where: { studentProfileId: profileId, skillId } });
  return getProfile(userId);
}

export async function addProject(userId: string, input: ProjectBody): Promise<StudentProfileDTO> {
  const profileId = await requireProfileId(userId);
  await prisma.project.create({
    data: {
      studentProfileId: profileId,
      title: input.title,
      description: input.description ?? null,
      techStack: input.techStack,
      url: input.url ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });
  return getProfile(userId);
}

export async function deleteProject(userId: string, projectId: string): Promise<StudentProfileDTO> {
  const profileId = await requireProfileId(userId);
  await prisma.project.deleteMany({ where: { id: projectId, studentProfileId: profileId } });
  return getProfile(userId);
}

export async function addExperience(userId: string, input: ExperienceBody): Promise<StudentProfileDTO> {
  const profileId = await requireProfileId(userId);
  await prisma.experience.create({
    data: {
      studentProfileId: profileId,
      title: input.title,
      organization: input.organization,
      description: input.description ?? null,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      isCurrent: input.isCurrent,
    },
  });
  return getProfile(userId);
}

export async function deleteExperience(userId: string, experienceId: string): Promise<StudentProfileDTO> {
  const profileId = await requireProfileId(userId);
  await prisma.experience.deleteMany({ where: { id: experienceId, studentProfileId: profileId } });
  return getProfile(userId);
}

export async function addCertification(userId: string, input: CertificationBody): Promise<StudentProfileDTO> {
  const profileId = await requireProfileId(userId);
  await prisma.certification.create({
    data: {
      studentProfileId: profileId,
      name: input.name,
      issuer: input.issuer ?? null,
      issueDate: input.issueDate ? new Date(input.issueDate) : null,
      url: input.url ?? null,
    },
  });
  return getProfile(userId);
}

export async function deleteCertification(userId: string, certificationId: string): Promise<StudentProfileDTO> {
  const profileId = await requireProfileId(userId);
  await prisma.certification.deleteMany({ where: { id: certificationId, studentProfileId: profileId } });
  return getProfile(userId);
}
