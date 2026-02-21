import { StatusDot } from "./StatusDot.js";

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const displayLabel = label ?? status;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <StatusDot status={status} />
      <span className="text-text-muted capitalize">{displayLabel}</span>
    </span>
  );
}
