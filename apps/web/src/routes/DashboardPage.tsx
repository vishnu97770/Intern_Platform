import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { RecommendationDTO } from "@intern-platform/shared";
import { getRecommendations } from "../lib/matchingApi";
import { ApiError } from "../lib/apiClient";
import { MatchScoreCard } from "../components/MatchScoreCard";

const liveModules = [
  { title: "Resume", description: "Upload a PDF/DOCX resume and review proposed profile data.", to: "/resume" },
  { title: "Internships", description: "Discover internships from every connected provider.", to: "/internships" },
  { title: "Applications", description: "Track every application in one place.", to: "/applications" },
];

const upcomingModules = [{ title: "Auto-apply", description: "Configure rules for automatic applications.", phase: "Phase 6" }];

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your profile is live. The modules below unlock as later build phases ship.
      </p>

      <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50 p-4">
        <p className="text-sm text-slate-700">
          Next step: fill out your{" "}
          <Link to="/profile" className="font-medium text-brand-700 hover:underline">
            career profile
          </Link>{" "}
          or{" "}
          <Link to="/resume" className="font-medium text-brand-700 hover:underline">
            upload a resume
          </Link>{" "}
          to have it filled in for you.
        </p>
      </div>

      <RecommendationsSection />

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {liveModules.map((mod) => (
          <li key={mod.title} className="rounded-lg border border-slate-200 bg-white p-4">
            <Link to={mod.to} className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{mod.title}</h2>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Live</span>
            </Link>
            <p className="mt-1 text-sm text-slate-500">{mod.description}</p>
          </li>
        ))}
        {upcomingModules.map((mod) => (
          <li key={mod.title} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{mod.title}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {mod.phase}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{mod.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecommendationsSection() {
  const [recommendations, setRecommendations] = useState<RecommendationDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecommendations({ pageSize: 3 })
      .then((res) => setRecommendations(res.items ?? []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load recommendations."));
  }, []);

  if (error) return null; // Non-critical widget — fail quietly rather than blocking the dashboard.
  if (recommendations === null) {
    return (
      <p className="mt-6 text-sm text-slate-500" role="status">
        Finding your best-matching internships…
      </p>
    );
  }
  if (recommendations.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No internships to recommend yet.{" "}
        <Link to="/internships" className="font-medium text-brand-700 hover:underline">
          Browse and sync internships
        </Link>{" "}
        to get matched.
      </div>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Recommended for you</h2>
        <Link to="/internships" className="text-sm font-medium text-brand-700 hover:underline">
          View all internships
        </Link>
      </div>
      <div className="mt-3 flex flex-col gap-4">
        {recommendations.map((rec) => (
          <div key={rec.internshipId}>
            <Link to={`/internships/${rec.internshipId}`} className="text-sm font-medium text-brand-700 hover:underline">
              {rec.internship.title} — {rec.internship.company}
            </Link>
            <MatchScoreCard match={rec} />
          </div>
        ))}
      </div>
    </section>
  );
}
