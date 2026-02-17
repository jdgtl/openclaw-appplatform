const statusColors: Record<string, string> = {
  active: "bg-success",
  idle: "bg-warning",
  error: "bg-danger",
  disabled: "bg-text-quaternary",
  online: "bg-success",
  offline: "bg-danger",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const colorClass = statusColors[status] ?? "bg-text-quaternary";
  const displayLabel = label ?? status;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`h-2 w-2 rounded-full ${colorClass}`}
        aria-hidden="true"
      />
      <span className="text-text-secondary capitalize">{displayLabel}</span>
    </span>
  );
}
