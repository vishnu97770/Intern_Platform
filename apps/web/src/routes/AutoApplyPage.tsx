import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { AutoApplyEvaluationDTO, AutoApplyQueueStatusDTO, AutoApplyRuleDTO, AutoApplyRunResultDTO } from "@intern-platform/shared";
import { approveQueuedApplication, getAutoApplyQueue, getAutoApplyRule, runAutoApply, updateAutoApplyRule } from "../lib/autoApplyApi";
import { ApiError } from "../lib/apiClient";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";

const OUTCOME_STYLES: Record<AutoApplyEvaluationDTO["outcome"], string> = {
  QUEUED: "bg-brand-50 text-brand-700",
  MANUAL_ACTION_REQUIRED: "bg-amber-100 text-amber-700",
  SKIPPED: "bg-slate-100 text-slate-500",
};

function listToText(list: string[]): string {
  return list.join(", ");
}

function textToList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AutoApplyPage() {
  const [rule, setRule] = useState<AutoApplyRuleDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<AutoApplyRunResultDTO | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [queue, setQueue] = useState<AutoApplyQueueStatusDTO | null>(null);

  function loadQueue() {
    getAutoApplyQueue()
      .then(setQueue)
      .catch(() => {
        /* Non-critical widget. */
      });
  }

  useEffect(() => {
    getAutoApplyRule()
      .then(setRule)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load your auto-apply settings."));
    loadQueue();
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!rule) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      setRule(await updateAutoApplyRule(rule));
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save your settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRun() {
    setIsRunning(true);
    setRunError(null);
    try {
      setRunResult(await runAutoApply());
      loadQueue();
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Couldn't run auto-apply.");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleApprove(applicationId: string) {
    await approveQueuedApplication(applicationId);
    loadQueue();
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-red-600" role="alert">
        {loadError}
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500" role="status">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Auto-apply</h1>
      <p className="mt-1 text-sm text-slate-500">
        Automatically apply to internships that meet your criteria. Nothing is submitted until you turn this on, and
        every decision is explainable below.
      </p>

      <form className="mt-6 rounded-lg border border-slate-200 bg-white p-5" onSubmit={handleSave}>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={rule.isEnabled} onChange={(e) => setRule({ ...rule, isEnabled: e.target.checked })} />
          <span className="text-sm font-medium text-slate-900">Auto Apply: {rule.isEnabled ? "ON" : "OFF"}</span>
        </label>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Minimum Match Score (%)"
            type="number"
            min={0}
            max={100}
            value={rule.minMatchScore}
            onChange={(e) => setRule({ ...rule, minMatchScore: Number(e.target.value) })}
          />
          <TextField
            label="Maximum Applications Per Day"
            type="number"
            min={1}
            value={rule.maxApplicationsPerDay}
            onChange={(e) => setRule({ ...rule, maxApplicationsPerDay: Number(e.target.value) })}
          />
          <TextField
            label="Preferred Roles (comma separated)"
            value={listToText(rule.preferredRoles)}
            onChange={(e) => setRule({ ...rule, preferredRoles: textToList(e.target.value) })}
          />
          <TextField
            label="Preferred Locations (comma separated)"
            value={listToText(rule.preferredLocations)}
            onChange={(e) => setRule({ ...rule, preferredLocations: textToList(e.target.value) })}
          />
          <TextField
            label="Excluded Companies (comma separated)"
            value={listToText(rule.excludedCompanies)}
            onChange={(e) => setRule({ ...rule, excludedCompanies: textToList(e.target.value) })}
          />
        </div>

        <label className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            checked={rule.requireManualApproval}
            onChange={(e) => setRule({ ...rule, requireManualApproval: e.target.checked })}
          />
          <span className="text-sm text-slate-700">
            Require Manual Approval: {rule.requireManualApproval ? "ON" : "OFF"} — when on, matches are queued but only
            submitted after you approve them below.
          </span>
        </label>

        {saveError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {saveError}
          </p>
        )}

        <Button type="submit" isLoading={isSaving} className="mt-4">
          Save settings
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Run</h2>
        <Button onClick={handleRun} isLoading={isRunning}>
          Run auto-apply now
        </Button>
      </div>
      {runError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {runError}
        </p>
      )}

      {runResult && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-700">
            Evaluated {runResult.evaluated} internship(s): <strong>{runResult.queued}</strong> queued,{" "}
            <strong>{runResult.manualActionRequired}</strong> need manual action, <strong>{runResult.skipped}</strong> skipped.
          </p>
          <ul className="mt-3 flex flex-col divide-y divide-slate-100">
            {runResult.evaluations.map((evaluation) => (
              <li key={evaluation.internshipId} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/internships/${evaluation.internshipId}`} className="text-sm font-medium text-brand-700 hover:underline">
                    {evaluation.internship.title} — {evaluation.internship.company}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_STYLES[evaluation.outcome]}`}>
                    {evaluation.outcome.replace(/_/g, " ")} · {evaluation.matchScore}%
                  </span>
                </div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {evaluation.checks.map((check) => (
                    <li
                      key={check.id}
                      title={check.detail}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${check.passed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                    >
                      {check.passed ? "✓" : "✗"} {check.id.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Queue status</h2>
        {!queue || queue.items.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No auto-apply activity yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {queue.items.map((item) => (
              <li key={item.applicationId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <Link to={`/internships/${item.internship.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    {item.internship.title} — {item.internship.company}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {item.status.replace(/_/g, " ")} {item.matchScore !== null && `· Match ${item.matchScore}%`}
                  </p>
                </div>
                {item.status === "QUEUED" && (
                  <Button variant="secondary" onClick={() => handleApprove(item.applicationId)}>
                    Approve &amp; submit
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
