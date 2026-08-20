import { useState, type FormEvent } from "react";
import type { StudentProfileDTO } from "@intern-platform/shared";
import { addProject, deleteProject } from "../../lib/profileApi";
import { Button } from "../Button";
import { TextField } from "../TextField";

export function ProjectsEditor({
  projects,
  onChange,
}: {
  projects: StudentProfileDTO["projects"];
  onChange: (profile: StudentProfileDTO) => void;
}) {
  const [title, setTitle] = useState("");
  const [techStack, setTechStack] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await addProject({
        title: title.trim(),
        techStack: techStack
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        url: url.trim() || null,
      });
      onChange(profile);
      setTitle("");
      setTechStack("");
      setUrl("");
    } catch {
      setError("Couldn't add that project. Check the URL format and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(projectId: string) {
    const profile = await deleteProject(projectId);
    onChange(profile);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Projects</h2>

      {projects.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No projects added yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {projects.map((project) => (
            <li key={project.id} className="flex items-start justify-between rounded-md border border-slate-100 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{project.title}</p>
                {project.techStack.length > 0 && (
                  <p className="text-xs text-slate-500">{project.techStack.join(", ")}</p>
                )}
                {project.url && (
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {project.url}
                  </a>
                )}
              </div>
              <Button variant="danger" onClick={() => handleDelete(project.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleAdd}>
        <div className="w-48">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="w-56">
          <TextField
            label="Tech stack (comma separated)"
            value={techStack}
            onChange={(e) => setTechStack(e.target.value)}
          />
        </div>
        <div className="w-56">
          <TextField label="URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" isLoading={isSubmitting}>
          Add project
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
