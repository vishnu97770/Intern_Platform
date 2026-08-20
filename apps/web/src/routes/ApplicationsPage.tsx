import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ApplicationDTO, ApplicationSearchParams, ApplicationStatus, PaginatedResult } from "@intern-platform/shared";
import { APPLICATION_STATUSES, deleteApplication, listApplications, updateApplicationStatus } from "../lib/applicationApi";
import { ApiError } from "../lib/apiClient";
import { Button } from "../components/Button";

type ApplicationSortByOption = NonNullable<ApplicationSearchParams["sortBy"]>;

const SORT_OPTIONS: { value: ApplicationSortByOption; label: string }[] = [
  { value: "recent", label: "Most recently tracked" },
  { value: "matchScore", label: "Highest match score" },
  { value: "deadline", label: "Deadline soonest" },
];

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  DISCOVERED: "bg-slate-100 text-slate-600",
  ELIGIBLE: "bg-slate-100 text-slate-600",
  QUEUED: "bg-blue-50 text-blue-700",
  APPLYING: "bg-blue-50 text-blue-700",
  APPLIED: "bg-brand-50 text-brand-700",
  FAILED: "bg-red-100 text-red-700",
  MANUAL_ACTION_REQUIRED: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
  INTERVIEW: "bg-purple-100 text-purple-700",
  OFFER: "bg-green-100 text-green-700",
  WITHDRAWN: "bg-slate-100 text-slate-500",
};

export function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<Set<ApplicationStatus>>(new Set());
  const [sortBy, setSortBy] = useState<ApplicationSortByOption>("recent");
  const [result, setResult] = useState<PaginatedResult<ApplicationDTO> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(page = 1) {
    setIsLoading(true);
    setError(null);
    const params: ApplicationSearchParams = { page, pageSize: 20, sortBy };
    if (statusFilter.size > 0) params.status = [...statusFilter];
    listApplications(params)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load your applications."))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [statusFilter, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleStatus(status: ApplicationStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  async function handleStatusChange(application: ApplicationDTO, status: ApplicationStatus) {
    try {
      await updateApplicationStatus(application.id, { status });
      load(result?.page ?? 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update status.");
    }
  }

  async function handleRemove(id: string) {
    await deleteApplication(id);
    load(result?.page ?? 1);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
      <p className="mt-1 text-sm text-slate-500">Every internship you're tracking, from discovery to offer.</p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {APPLICATION_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter.has(status) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {status.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="app-sort" className="text-sm font-medium text-slate-700">
              Sort by
            </label>
            <select
              id="app-sort"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ApplicationSortByOption)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500" role="status">
          Loading…
        </p>
      ) : !result || result.items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No applications tracked yet.{" "}
          <Link to="/internships" className="font-medium text-brand-700 hover:underline">
            Browse internships
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-4">
            {result.items.map((application) => (
              <li key={application.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/internships/${application.internship.id}`} className="text-base font-semibold text-brand-700 hover:underline">
                      {application.internship.title}
                    </Link>
                    <p className="text-sm text-slate-600">
                      {application.internship.company} • Source: {application.internship.source}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[application.status]}`}>
                    {application.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                  {application.matchScore !== null && <span>Match: {application.matchScore}%</span>}
                  <span>Tracked: {new Date(application.createdAt).toLocaleDateString()}</span>
                  {application.appliedAt && <span>Applied: {new Date(application.appliedAt).toLocaleDateString()}</span>}
                  {application.failureReason && <span className="text-red-600">Reason: {application.failureReason}</span>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label htmlFor={`status-${application.id}`} className="text-sm font-medium text-slate-700">
                    Update status
                  </label>
                  <select
                    id={`status-${application.id}`}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={application.status}
                    onChange={(e) => handleStatusChange(application, e.target.value as ApplicationStatus)}
                  >
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <a
                    href={application.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-brand-700 hover:underline"
                  >
                    Open application
                  </a>
                  <Button variant="danger" onClick={() => handleRemove(application.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {result.page} of {result.totalPages} ({result.total} total)
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={result.page <= 1} onClick={() => load(result.page - 1)}>
                Previous
              </Button>
              <Button variant="secondary" disabled={result.page >= result.totalPages} onClick={() => load(result.page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
