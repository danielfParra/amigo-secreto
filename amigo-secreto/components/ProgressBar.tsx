export default function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const slots = Math.max(0, Math.min(max, 60));
  const filled = Math.min(value, slots);
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      {Array.from({ length: slots }, (_, i) => (
        <span key={i} className={i < filled ? "on" : undefined} style={{ animationDelay: `${i * 45}ms` }} />
      ))}
    </div>
  );
}
