import type { InputHTMLAttributes } from "react";

type Props = {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

export default function Field({ id, label, hint, error, ...input }: Props) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && !error && (
        <span id={`${id}-hint`} style={{ fontSize: 13, color: "var(--muted)" }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="error">
          {error}
        </span>
      )}
    </div>
  );
}
