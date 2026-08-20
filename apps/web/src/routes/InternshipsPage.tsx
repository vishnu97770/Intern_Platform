import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { InternshipSearchParams, InternshipSortBy, InternshipSummaryDTO, InternshipWorkMode, PaginatedResult } from "@intern-platform/shared";
import { searchInternships, syncInternships } from "../lib/internshipApi";
import { ApiError } from "../lib/apiClient";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";

const WORK_MODES: InternshipWorkMode[] = ["REMOTE", "HYBRID", "ONSITE"];
const SORT_OPTIONS: { value: InternshipSortBy; label: string }[] = [
  { value: "recent", label: "Most recently discovered" },
  { value: "deadline", label: "Deadline soonest" },
  { value: "stipend", label: "Highest stipend" },
];

function formatStipend(min: number | null, max: number | null, currency: string | null): string {
  if (min === null && max === null) return "Not specified";
  if (min === 0 && max === 0) return "Unpaid";
  const cur = currency ?? "";
  if (min === max) return `${cur} ${min?.toLocaleString()}/mo`;
  return `${cur} ${min?.toLocaleString() ?? "?"} - ${max?.toLocaleString() ?? "?"}/mo`;
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "No deadline listed";
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Deadline today";
  return `${days} day${days === 1 ? "" : "s"} left to apply`;
}

export function InternshipsPage() {
  const [filters, setFilters] = useState<InternshipSearchParams>({ page: 1, pageSize: 10, sortBy: "recent" });
  const [result, setResult] = useState<PaginatedResult<InternshipSummaryDTO> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  function load(params: InternshipSearchParams) {
    setIsLoading(true);
    setError(null);
    searchInternships(params)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load internships."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => load(filters), []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = { ...filters, page: 1 };
    setFilters(next);
    load(next);
  }

  function goToPage(page: number) {
    const next = { ...filters, page };
    setFilters(next);
    load(next);
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncNote(null);
    try {
      const results = await syncInternships();
      const total = results.reduce((sum, r) => sum + r.created + r.updated, 0);
      setSyncNote(`Synced ${total} listing(s) from ${results.length} provider(s).`);
      load(filters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Internships</h1>
          <p className="mt-1 text-sm text-slate-500">Discover internships from every connected provider.</p>
        </div>
        <Button variant="secondary" onClick={handleSync} isLoading={isSyncing}>
          Sync now
        </Button>
      </div>
      {syncNote && (
        <p className="mt-2 text-sm text-green-600" role="status">
          {syncNote}
        </p>
      )}

      <form className="mt-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleSubmit}>
        <TextField
          label="Search"
          placeholder="Title or company"
          value={filters.q ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <TextField
          label="Location"
          value={filters.location ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
        />
        <TextField
          label="Skill"
          placeholder="e.g. Python"
          value={filters.skill ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, skill: e.target.value }))}
        />
        <TextField
          label="Min stipend"
          type="number"
          value={filters.minStipend ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, minStipend: e.target.value ? Number(e.target.value) : undefined }))}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="work-mode-filter" className="text-sm font-medium text-slate-700">
            Work mode
          </label>
          <select
            id="work-mode-filter"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filters.workMode ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, workMode: (e.target.value || undefined) as InternshipWorkMode | undefined }))}
          >
            <option value="">Any</option>
            {WORK_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sort-by" className="text-sm font-medium text-slate-700">
            Sort by
          </label>
          <select
            id="sort-by"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filters.sortBy ?? "recent"}
            onChange={(e) => setFilters((f) => ({ ...f, sortBy: e.target.value as InternshipSortBy }))}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Apply filters
          </Button>
        </div>
      </form>

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
        <p className="mt-6 text-sm text-slate-500">No internships found. Try syncing or adjusting your filters.</p>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-4">
            {result.items.map((internship) => (
              <li key={internship.id} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link to={`/internships/${internship.id}`} className="text-base font-semibold text-brand-700 hover:underline">
                      {internship.title}
                    </Link>
                    <p className="text-sm text-slate-600">
                      {internship.company} • {internship.location ?? "Location not specified"}
                    </p>
                  </div>
                  {internship.workMode && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{internship.workMode}</span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                  <span>{formatStipend(internship.stipendMin, internship.stipendMax, internship.stipendCurrency)}</span>
                  <span>{formatDeadline(internship.applicationDeadline)}</span>
                  <span>Source: {internship.source}</span>
                </div>

                {internship.requiredSkills.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {internship.requiredSkills.map((skill) => (
                      <li key={skill} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {skill}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {result.page} of {result.totalPages} ({result.total} total)
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={result.page <= 1} onClick={() => goToPage(result.page - 1)}>
                Previous
              </Button>
              <Button variant="secondary" disabled={result.page >= result.totalPages} onClick={() => goToPage(result.page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
