import type { AutoApplyRuleDTO, UpdateAutoApplyRuleInput } from "@intern-platform/shared";
import type { AutoApplyRule } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { NotFoundError } from "../../lib/errors.js";

function toDTO(rule: AutoApplyRule): AutoApplyRuleDTO {
  return {
    isEnabled: rule.isEnabled,
    minMatchScore: rule.minMatchScore,
    maxApplicationsPerDay: rule.maxApplicationsPerDay,
    preferredRoles: rule.preferredRoles,
    preferredLocations: rule.preferredLocations,
    excludedCompanies: rule.excludedCompanies,
    requireManualApproval: rule.requireManualApproval,
    updatedAt: rule.updatedAt.toISOString(),
  };
}

async function requireProfileId(userId: string): Promise<string> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError("Student profile not found");
  return profile.id;
}

/** Every student implicitly has a rule row (defaults: disabled, manual approval required) — created on first read. */
export async function getRule(userId: string): Promise<AutoApplyRuleDTO> {
  const profileId = await requireProfileId(userId);
  const rule = await prisma.autoApplyRule.upsert({
    where: { studentProfileId: profileId },
    update: {},
    create: { studentProfileId: profileId },
  });
  return toDTO(rule);
}

export async function updateRule(userId: string, input: UpdateAutoApplyRuleInput): Promise<AutoApplyRuleDTO> {
  const profileId = await requireProfileId(userId);
  const rule = await prisma.autoApplyRule.upsert({
    where: { studentProfileId: profileId },
    update: input,
    create: { studentProfileId: profileId, ...input },
  });
  return toDTO(rule);
}

export async function getRuleRow(profileId: string): Promise<AutoApplyRule> {
  return prisma.autoApplyRule.upsert({
    where: { studentProfileId: profileId },
    update: {},
    create: { studentProfileId: profileId },
  });
}

export { toDTO as toAutoApplyRuleDTO };
