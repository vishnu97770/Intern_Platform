import type { MatchResultDTO } from "@intern-platform/shared";

const BREAKDOWN_LABELS: Record<keyof MatchResultDTO["breakdown"], string> = {
  skillMatch: "Skill",
  educationMatch: "Education",
  experienceMatch: "Experience",
  locationMatch: "Location",
  roleMatch: "Role",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

/** Renders a MatchResultDTO the same way everywhere it's shown (dashboard recommendations, internship detail). */
export function MatchScoreCard({ match }: { match: MatchResultDTO }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className={`text-lg font-semibold ${scoreColor(match.overallScore)}`}>Overall Match: {match.overallScore}%</p>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        {(Object.keys(BREAKDOWN_LABELS) as Array<keyof MatchResultDTO["breakdown"]>).map((key) => (
          <div key={key}>
            <dt className="text-slate-500">{BREAKDOWN_LABELS[key]}</dt>
            <dd className="font-medium text-slate-900">{match.breakdown[key]}%</dd>
          </div>
        ))}
      </dl>

      {match.explanation.strongMatches.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Strong matches</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {match.explanation.strongMatches.map((s) => (
              <li key={s} className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                ✓ {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.explanation.missing.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Missing</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {match.explanation.missing.map((s) => (
              <li key={s} className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                ✗ {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {match.explanation.concerns.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Potential concerns</p>
          <ul className="mt-1 flex flex-col gap-1">
            {match.explanation.concerns.map((c) => (
              <li key={c} className="text-xs text-amber-700">
                ⚠ {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
