export function ProgressBar({
  value,
  color = "#06b6d4",
}: {
  value: number;
  color?: string;
}) {
  return (
    <div className="h-[3px] bg-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-1000 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}
