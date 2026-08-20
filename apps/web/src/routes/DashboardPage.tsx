import { Link } from "react-router-dom";

const upcomingModules = [
  { title: "Resume", description: "Upload a PDF/DOCX resume and auto-fill your profile.", phase: "Phase 2" },
  { title: "Internships", description: "Discover internships from multiple sources.", phase: "Phase 3" },
  { title: "Matches", description: "See your match score and why you matched.", phase: "Phase 4" },
  { title: "Applications", description: "Track every application in one place.", phase: "Phase 5" },
  { title: "Auto-apply", description: "Configure rules for automatic applications.", phase: "Phase 6" },
];

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
          so future matching has something to work with.
        </p>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
