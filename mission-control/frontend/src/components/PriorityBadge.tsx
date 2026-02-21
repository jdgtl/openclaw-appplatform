const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-danger/12 text-danger border border-danger/25",
  medium: "bg-warning/12 text-warning border border-warning/25",
  low: "bg-success/12 text-success border border-success/25",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority] ?? "bg-surface-hover text-text-dim border border-border";

  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${style}`}>
      {priority}
    </span>
  );
}
