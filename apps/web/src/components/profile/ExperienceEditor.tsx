import { useState, type FormEvent } from "react";
import type { StudentProfileDTO } from "@intern-platform/shared";
import { addExperience, deleteExperience } from "../../lib/profileApi";
import { Button } from "../Button";
import { TextField } from "../TextField";

export function ExperienceEditor({
  experience,
  onChange,
}: {
  experience: StudentProfileDTO["experience"];
  onChange: (profile: StudentProfileDTO) => void;
}) {
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !organization.trim() || !startDate) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await addExperience({
        title: title.trim(),
        organization: organization.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: isCurrent || !endDate ? null : new Date(endDate).toISOString(),
        isCurrent,
      });
      onChange(profile);
      setTitle("");
      setOrganization("");
      setStartDate("");
      setEndDate("");
      setIsCurrent(false);
    } catch {
      setError("Couldn't add that entry. Check the dates and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(experienceId: string) {
    const profile = await deleteExperience(experienceId);
    onChange(profile);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Experience</h2>

      {experience.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No experience added yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {experience.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between rounded-md border border-slate-100 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {entry.title} · {entry.organization}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(entry.startDate).toLocaleDateString()} —{" "}
                  {entry.isCurrent ? "Present" : entry.endDate ? new Date(entry.endDate).toLocaleDateString() : "—"}
                </p>
              </div>
              <Button variant="danger" onClick={() => handleDelete(entry.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleAdd}>
        <div className="w-44">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="w-44">
          <TextField label="Organization" value={organization} onChange={(e) => setOrganization(e.target.value)} />
        </div>
        <div className="w-40">
          <TextField
            label="Start date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="w-40">
          <TextField
            label="End date"
            type="date"
            disabled={isCurrent}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
          Current
        </label>
        <Button type="submit" variant="secondary" isLoading={isSubmitting}>
          Add
        </Button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
