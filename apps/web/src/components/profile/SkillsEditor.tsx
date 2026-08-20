import { useState, type FormEvent } from "react";
import type { StudentProfileDTO, SkillCategory } from "@intern-platform/shared";
import { addSkill, removeSkill } from "../../lib/profileApi";
import { Button } from "../Button";
import { TextField } from "../TextField";

const categories: SkillCategory[] = ["LANGUAGE", "FRAMEWORK", "DATABASE", "CLOUD", "TOOL", "OTHER"];

export function SkillsEditor({
  skills,
  onChange,
}: {
  skills: StudentProfileDTO["skills"];
  onChange: (profile: StudentProfileDTO) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SkillCategory>("LANGUAGE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await addSkill({ name: name.trim(), category });
      onChange(profile);
      setName("");
    } catch {
      setError("Couldn't add that skill. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(skillId: string) {
    const profile = await removeSkill(skillId);
    onChange(profile);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Skills</h2>

      {skills.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No skills added yet. Add the ones you're strongest in.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {skill.name}
              <span className="text-xs text-slate-400">{skill.category.toLowerCase()}</span>
              <button
                type="button"
                onClick={() => handleRemove(skill.id)}
                aria-label={`Remove ${skill.name}`}
                className="text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleAdd}>
        <div className="w-40">
          <TextField label="Skill" placeholder="e.g. Python" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="skill-category" className="text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="skill-category"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={category}
            onChange={(e) => setCategory(e.target.value as SkillCategory)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" isLoading={isSubmitting}>
          Add skill
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
