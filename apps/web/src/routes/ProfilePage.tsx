import { useEffect, useState, type FormEvent } from "react";
import type { StudentProfileDTO, WorkModePreference } from "@intern-platform/shared";
import { getProfile, updateProfile } from "../lib/profileApi";
import { ApiError } from "../lib/apiClient";
import { TextField } from "../components/TextField";
import { Button } from "../components/Button";
import { SkillsEditor } from "../components/profile/SkillsEditor";
import { ProjectsEditor } from "../components/profile/ProjectsEditor";
import { ExperienceEditor } from "../components/profile/ExperienceEditor";
import { CertificationsEditor } from "../components/profile/CertificationsEditor";

const workModes: WorkModePreference[] = ["ANY", "REMOTE", "HYBRID", "ONSITE"];

export function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfileDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load your profile."))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500" role="status">
        Loading your profile…
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-red-600" role="alert">
        {loadError ?? "Profile not found."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Your profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        This information is used to match you against internships once matching goes live.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <CoreDetailsForm profile={profile} onSaved={setProfile} />
        <SkillsEditor skills={profile.skills} onChange={setProfile} />
        <ProjectsEditor projects={profile.projects} onChange={setProfile} />
        <ExperienceEditor experience={profile.experience} onChange={setProfile} />
        <CertificationsEditor certifications={profile.certifications} onChange={setProfile} />
      </div>
    </div>
  );
}

function CoreDetailsForm({
  profile,
  onSaved,
}: {
  profile: StudentProfileDTO;
  onSaved: (profile: StudentProfileDTO) => void;
}) {
  const [form, setForm] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateProfile({
        fullName: form.fullName,
        phone: form.phone,
        location: form.location,
        college: form.college,
        degree: form.degree,
        branch: form.branch,
        graduationYear: form.graduationYear,
        cgpa: form.cgpa,
        bio: form.bio,
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
        portfolioUrl: form.portfolioUrl,
        preferredRoles: form.preferredRoles,
        preferredLocations: form.preferredLocations,
        workModePreference: form.workModePreference,
      });
      onSaved(updated);
      setForm(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your changes.");
    } finally {
      setIsSaving(false);
    }
  }

  function field<K extends keyof StudentProfileDTO>(key: K, value: StudentProfileDTO[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white p-5" onSubmit={handleSubmit}>
      <h2 className="text-base font-semibold text-slate-900">Basic details</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Full name" required value={form.fullName} onChange={(e) => field("fullName", e.target.value)} />
        <TextField label="Phone" value={form.phone ?? ""} onChange={(e) => field("phone", e.target.value || null)} />
        <TextField
          label="Location"
          value={form.location ?? ""}
          onChange={(e) => field("location", e.target.value || null)}
        />
        <TextField label="College" value={form.college ?? ""} onChange={(e) => field("college", e.target.value || null)} />
        <TextField label="Degree" value={form.degree ?? ""} onChange={(e) => field("degree", e.target.value || null)} />
        <TextField label="Branch / major" value={form.branch ?? ""} onChange={(e) => field("branch", e.target.value || null)} />
        <TextField
          label="Graduation year"
          type="number"
          value={form.graduationYear ?? ""}
          onChange={(e) => field("graduationYear", e.target.value ? Number(e.target.value) : null)}
        />
        <TextField
          label="CGPA (0-10)"
          type="number"
          step="0.01"
          value={form.cgpa ?? ""}
          onChange={(e) => field("cgpa", e.target.value ? Number(e.target.value) : null)}
        />
        <TextField
          label="GitHub URL"
          type="url"
          value={form.githubUrl ?? ""}
          onChange={(e) => field("githubUrl", e.target.value || null)}
        />
        <TextField
          label="LinkedIn URL"
          type="url"
          value={form.linkedinUrl ?? ""}
          onChange={(e) => field("linkedinUrl", e.target.value || null)}
        />
        <TextField
          label="Portfolio URL"
          type="url"
          value={form.portfolioUrl ?? ""}
          onChange={(e) => field("portfolioUrl", e.target.value || null)}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="work-mode" className="text-sm font-medium text-slate-700">
            Preferred work mode
          </label>
          <select
            id="work-mode"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={form.workModePreference}
            onChange={(e) => field("workModePreference", e.target.value as WorkModePreference)}
          >
            {workModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Preferred roles (comma separated)"
          value={form.preferredRoles.join(", ")}
          onChange={(e) =>
            field(
              "preferredRoles",
              e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            )
          }
        />
        <TextField
          label="Preferred locations (comma separated)"
          value={form.preferredLocations.join(", ")}
          onChange={(e) =>
            field(
              "preferredLocations",
              e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            )
          }
        />
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <label htmlFor="bio" className="text-sm font-medium text-slate-700">
          Bio
        </label>
        <textarea
          id="bio"
          rows={3}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={form.bio ?? ""}
          onChange={(e) => field("bio", e.target.value || null)}
        />
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {savedAt && !error && (
        <p className="mt-3 text-sm text-green-600" role="status">
          Saved.
        </p>
      )}

      <Button type="submit" isLoading={isSaving} className="mt-4">
        Save changes
      </Button>
    </form>
  );
}
