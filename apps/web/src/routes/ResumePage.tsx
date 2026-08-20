import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { ConfirmResumeInput, ParsedResume, ResumeDetailDTO, ResumeDTO } from "@intern-platform/shared";
import { confirmResume, deleteResume, getResume, listResumes, uploadResume } from "../lib/resumeApi";
import { ApiError } from "../lib/apiClient";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";

const PROFILE_FIELD_LABELS: Record<ProfileFieldKey, string> = {
  fullName: "Full name",
  phone: "Phone",
  location: "Location",
  college: "College",
  degree: "Degree",
  branch: "Branch / major",
  graduationYear: "Graduation year",
  cgpa: "CGPA (0-10)",
  githubUrl: "GitHub URL",
  linkedinUrl: "LinkedIn URL",
  portfolioUrl: "Portfolio URL",
};

type ProfileFieldKey =
  | "fullName" | "phone" | "location" | "college" | "degree" | "branch"
  | "graduationYear" | "cgpa" | "githubUrl" | "linkedinUrl" | "portfolioUrl";

const PROFILE_FIELD_KEYS = Object.keys(PROFILE_FIELD_LABELS) as ProfileFieldKey[];

function statusBadgeClass(status: ResumeDTO["status"]): string {
  switch (status) {
    case "CONFIRMED": return "bg-green-100 text-green-700";
    case "PARSED": return "bg-brand-50 text-brand-700";
    case "FAILED": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

export function ResumePage() {
  const [resumes, setResumes] = useState<ResumeDTO[] | null>(null);
  const [selected, setSelected] = useState<ResumeDetailDTO | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reloadList() {
    listResumes()
      .then(setResumes)
      .catch((err) => setListError(err instanceof ApiError ? err.message : "Couldn't load your resumes."));
  }

  useEffect(reloadList, []);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const resume = await uploadResume(file);
      setSelected(resume);
      reloadList();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSelect(id: string) {
    try {
      const resume = await getResume(id);
      setSelected(resume);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Couldn't load that resume.");
    }
  }

  async function handleDelete(id: string) {
    await deleteResume(id);
    if (selected?.id === id) setSelected(null);
    reloadList();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Resume</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload a PDF or DOCX resume. We&apos;ll extract and propose profile data — nothing is applied to your
        profile until you review it and confirm.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-5" onSubmit={handleUpload}>
        <div className="flex flex-col gap-1">
          <label htmlFor="resume-file" className="text-sm font-medium text-slate-700">
            Resume file (PDF or DOCX, max 5MB)
          </label>
          <input
            id="resume-file"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
        </div>
        <Button type="submit" isLoading={isUploading}>
          Upload &amp; parse
        </Button>
        {uploadError && (
          <p className="w-full text-sm text-red-600" role="alert">
            {uploadError}
          </p>
        )}
      </form>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Your resumes</h2>
        {listError && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {listError}
          </p>
        )}
        {resumes === null ? (
          <p className="mt-2 text-sm text-slate-500" role="status">
            Loading…
          </p>
        ) : resumes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No resumes uploaded yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-slate-100">
            {resumes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <button
                  type="button"
                  onClick={() => handleSelect(r.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <span className="truncate text-sm font-medium text-slate-900">{r.fileName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}>
                    {r.status}
                  </span>
                  <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</span>
                </button>
                <Button variant="danger" onClick={() => handleDelete(r.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <div className="mt-6">
          {selected.status === "FAILED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700" role="alert">
              Couldn&apos;t parse <strong>{selected.fileName}</strong>: {selected.failureReason ?? "Unknown error."}
              {" "}Try re-uploading, or a different file.
            </div>
          )}
          {selected.status === "UPLOADED" && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500" role="status">
              Parsing…
            </div>
          )}
          {(selected.status === "PARSED" || selected.status === "CONFIRMED") && selected.parsedData && (
            <ReviewPanel key={selected.id} resume={selected} parsedData={selected.parsedData} onConfirmed={(r) => { setSelected(r); reloadList(); }} />
          )}
        </div>
      )}
    </div>
  );
}

function ReviewPanel({
  resume,
  parsedData,
  onConfirmed,
}: {
  resume: ResumeDetailDTO;
  parsedData: ParsedResume;
  onConfirmed: (resume: ResumeDetailDTO) => void;
}) {
  const [profileFields, setProfileFields] = useState(() => buildProfileFieldsState(parsedData));
  const [skills, setSkills] = useState(() => parsedData.skills.map((s) => ({ ...s, include: true })));
  const [projects, setProjects] = useState(() =>
    parsedData.projects.map((p) => ({ title: p.title, description: p.description ?? "", techStack: p.techStack.join(", "), include: true })),
  );
  const [experience, setExperience] = useState(() =>
    parsedData.experience.map((e) => ({ title: e.title, organization: e.organization, description: e.description ?? "", startDate: "", include: false })),
  );
  const [certifications, setCertifications] = useState(() =>
    parsedData.certifications.map((c) => ({ name: c.name, issuer: c.issuer ?? "", include: true })),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedNote, setConfirmedNote] = useState<string | null>(null);

  function updateField(key: ProfileFieldKey, patch: Partial<{ value: string; include: boolean }>) {
    setProfileFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const experienceToInclude = experience.filter((e) => e.include);
    if (experienceToInclude.some((e) => !e.startDate)) {
      setError("Set a start date for every experience entry you want to include, or uncheck it.");
      return;
    }

    const profile: ConfirmResumeInput["profile"] = {};
    for (const key of PROFILE_FIELD_KEYS) {
      const field = profileFields[key];
      if (!field.include) continue;
      if (key === "graduationYear") {
        (profile as Record<string, unknown>)[key] = field.value ? Number(field.value) : null;
      } else if (key === "cgpa") {
        (profile as Record<string, unknown>)[key] = field.value ? Number(field.value) : null;
      } else {
        (profile as Record<string, unknown>)[key] = field.value || null;
      }
    }

    const input: ConfirmResumeInput = {
      profile,
      skills: skills.filter((s) => s.include).map((s) => ({ name: s.name, category: s.category })),
      projects: projects
        .filter((p) => p.include)
        .map((p) => ({
          title: p.title,
          description: p.description || null,
          techStack: p.techStack.split(",").map((t) => t.trim()).filter(Boolean),
        })),
      experience: experienceToInclude.map((e) => ({
        title: e.title,
        organization: e.organization,
        description: e.description || null,
        startDate: new Date(e.startDate).toISOString(),
        isCurrent: false,
      })),
      certifications: certifications
        .filter((c) => c.include)
        .map((c) => ({ name: c.name, issuer: c.issuer || null })),
    };

    setIsSubmitting(true);
    try {
      const result = await confirmResume(resume.id, input);
      setConfirmedNote(`Applied to your profile at ${new Date().toLocaleTimeString()}.`);
      onConfirmed(result.resume);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update your profile. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Review proposed profile data</h2>
          <span className="text-xs text-slate-400">
            Confidence: {parsedData.confidence != null ? Math.round(parsedData.confidence * 100) : "?"}%
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Uncheck anything that&apos;s wrong, edit values as needed, then confirm to update your profile.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PROFILE_FIELD_KEYS.map((key) => (
            <label key={key} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-2.5"
                checked={profileFields[key].include}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateField(key, { include: e.target.checked })}
              />
              <div className="flex-1">
                <TextField
                  label={PROFILE_FIELD_LABELS[key]}
                  type={key === "graduationYear" || key === "cgpa" ? "number" : "text"}
                  value={profileFields[key].value}
                  onChange={(e) => updateField(key, { value: e.target.value })}
                />
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Skills ({skills.length})</h3>
        {skills.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No skills detected.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <li key={`${s.name}-${i}`}>
                <label className="flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={s.include}
                    onChange={(e) => setSkills((prev) => prev.map((p, idx) => (idx === i ? { ...p, include: e.target.checked } : p)))}
                  />
                  {s.name}
                  <span className="text-xs text-slate-400">{s.category.toLowerCase()}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Projects ({projects.length})</h3>
        {projects.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No projects detected.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {projects.map((p, i) => (
              <label key={i} className="flex items-start gap-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                <input
                  type="checkbox"
                  className="mt-2.5"
                  checked={p.include}
                  onChange={(e) => setProjects((prev) => prev.map((x, idx) => (idx === i ? { ...x, include: e.target.checked } : x)))}
                />
                <div className="flex-1 flex flex-col gap-2">
                  <TextField
                    label="Title"
                    value={p.title}
                    onChange={(e) => setProjects((prev) => prev.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))}
                  />
                  <TextField
                    label="Tech stack (comma separated)"
                    value={p.techStack}
                    onChange={(e) => setProjects((prev) => prev.map((x, idx) => (idx === i ? { ...x, techStack: e.target.value } : x)))}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-slate-700">Description</span>
                    <textarea
                      rows={2}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={p.description}
                      onChange={(e) => setProjects((prev) => prev.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)))}
                    />
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Experience ({experience.length})</h3>
        {experience.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No experience detected.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {experience.map((e, i) => (
              <label key={i} className="flex items-start gap-2 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                <input
                  type="checkbox"
                  className="mt-2.5"
                  checked={e.include}
                  onChange={(ev) => setExperience((prev) => prev.map((x, idx) => (idx === i ? { ...x, include: ev.target.checked } : x)))}
                />
                <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <TextField
                    label="Title"
                    value={e.title}
                    onChange={(ev) => setExperience((prev) => prev.map((x, idx) => (idx === i ? { ...x, title: ev.target.value } : x)))}
                  />
                  <TextField
                    label="Organization"
                    value={e.organization}
                    onChange={(ev) => setExperience((prev) => prev.map((x, idx) => (idx === i ? { ...x, organization: ev.target.value } : x)))}
                  />
                  <TextField
                    label="Start date"
                    type="date"
                    value={e.startDate}
                    onChange={(ev) => setExperience((prev) => prev.map((x, idx) => (idx === i ? { ...x, startDate: ev.target.value } : x)))}
                  />
                </div>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Certifications ({certifications.length})</h3>
        {certifications.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No certifications detected.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {certifications.map((c, i) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.include}
                  onChange={(e) => setCertifications((prev) => prev.map((x, idx) => (idx === i ? { ...x, include: e.target.checked } : x)))}
                />
                <span className="text-sm text-slate-700">
                  {c.name}
                  {c.issuer ? ` — ${c.issuer}` : ""}
                </span>
              </label>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {confirmedNote && !error && (
        <p className="text-sm text-green-600" role="status">
          {confirmedNote}
        </p>
      )}

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        Confirm and update profile
      </Button>
    </form>
  );
}

function buildProfileFieldsState(parsed: ParsedResume): Record<ProfileFieldKey, { value: string; include: boolean }> {
  const state = {} as Record<ProfileFieldKey, { value: string; include: boolean }>;
  for (const key of PROFILE_FIELD_KEYS) {
    const raw = parsed[key];
    const hasValue = raw !== null && raw !== undefined && raw !== "";
    state[key] = { value: hasValue ? String(raw) : "", include: hasValue };
  }
  return state;
}
