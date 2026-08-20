import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { InternshipDetailDTO } from "@intern-platform/shared";
import { getInternship } from "../lib/internshipApi";
import { ApiError } from "../lib/apiClient";

export function InternshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [internship, setInternship] = useState<InternshipDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    getInternship(id)
      .then(setInternship)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this internship."))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500" role="status">
        Loading…
      </div>
    );
  }

  if (error || !internship) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-red-600" role="alert">
        {error ?? "Internship not found."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/internships" className="text-sm text-brand-700 hover:underline">
        ← Back to internships
      </Link>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{internship.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {internship.company} • {internship.location ?? "Location not specified"}
            </p>
          </div>
          {internship.workMode && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{internship.workMode}</span>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">Stipend</dt>
            <dd className="text-slate-900">
              {internship.stipendMin === 0 && internship.stipendMax === 0
                ? "Unpaid"
                : internship.stipendMin !== null
                  ? `${internship.stipendCurrency ?? ""} ${internship.stipendMin.toLocaleString()} - ${internship.stipendMax?.toLocaleString()}/mo`
                  : "Not specified"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Duration</dt>
            <dd className="text-slate-900">{internship.durationMonths ? `${internship.durationMonths} months` : "Not specified"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Application deadline</dt>
            <dd className="text-slate-900">
              {internship.applicationDeadline ? new Date(internship.applicationDeadline).toLocaleDateString() : "Not specified"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Eligible graduating years</dt>
            <dd className="text-slate-900">
              {internship.minGraduationYear || internship.maxGraduationYear
                ? `${internship.minGraduationYear ?? "?"} - ${internship.maxGraduationYear ?? "?"}`
                : "Not specified"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Minimum experience</dt>
            <dd className="text-slate-900">
              {internship.minExperienceMonths !== null ? `${internship.minExperienceMonths} months` : "Not specified"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Source</dt>
            <dd className="text-slate-900">{internship.source}</dd>
          </div>
        </dl>

        {internship.requiredSkills.length > 0 && (
          <div className="mt-5">
            <h2 className="text-sm font-medium text-slate-500">Required skills</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {internship.requiredSkills.map((skill) => (
                <li key={skill} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        )}

        {internship.preferredSkills.length > 0 && (
          <div className="mt-3">
            <h2 className="text-sm font-medium text-slate-500">Preferred skills</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {internship.preferredSkills.map((skill) => (
                <li key={skill} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <h2 className="text-sm font-medium text-slate-500">Description</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{internship.description}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={internship.applicationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Apply on {internship.source}
          </a>
          <a
            href={internship.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            View original listing
          </a>
        </div>
      </div>
    </div>
  );
}
