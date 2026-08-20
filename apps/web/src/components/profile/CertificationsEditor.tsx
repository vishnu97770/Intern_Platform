import { useState, type FormEvent } from "react";
import type { StudentProfileDTO } from "@intern-platform/shared";
import { addCertification, deleteCertification } from "../../lib/profileApi";
import { Button } from "../Button";
import { TextField } from "../TextField";

export function CertificationsEditor({
  certifications,
  onChange,
}: {
  certifications: StudentProfileDTO["certifications"];
  onChange: (profile: StudentProfileDTO) => void;
}) {
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await addCertification({ name: name.trim(), issuer: issuer.trim() || null });
      onChange(profile);
      setName("");
      setIssuer("");
    } catch {
      setError("Couldn't add that certification. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(certificationId: string) {
    const profile = await deleteCertification(certificationId);
    onChange(profile);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">Certifications</h2>

      {certifications.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No certifications added yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {certifications.map((cert) => (
            <li key={cert.id} className="flex items-start justify-between rounded-md border border-slate-100 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{cert.name}</p>
                {cert.issuer && <p className="text-xs text-slate-500">{cert.issuer}</p>}
              </div>
              <Button variant="danger" onClick={() => handleDelete(cert.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleAdd}>
        <div className="w-56">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="w-56">
          <TextField label="Issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
        </div>
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
