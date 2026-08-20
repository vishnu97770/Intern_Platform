import type {
  ApplicationDTO,
  AutoApplyQueueStatusDTO,
  AutoApplyRuleDTO,
  AutoApplyRunResultDTO,
  UpdateAutoApplyRuleInput,
} from "@intern-platform/shared";
import { apiRequest } from "./apiClient";

export const getAutoApplyRule = () => apiRequest<AutoApplyRuleDTO>("/auto-apply/rule");

export const updateAutoApplyRule = (input: UpdateAutoApplyRuleInput) =>
  apiRequest<AutoApplyRuleDTO>("/auto-apply/rule", { method: "PATCH", body: input });

export const runAutoApply = () => apiRequest<AutoApplyRunResultDTO>("/auto-apply/run", { method: "POST" });

export const getAutoApplyQueue = () => apiRequest<AutoApplyQueueStatusDTO>("/auto-apply/queue");

export const approveQueuedApplication = (applicationId: string) =>
  apiRequest<ApplicationDTO>(`/auto-apply/queue/${applicationId}/approve`, { method: "POST" });
