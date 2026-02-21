const statusColors: Record<string, string> = {
  active: "#22c55e",
  error: "#ef4444",
  paused: "#f59e0b",
  idle: "#f59e0b",
  disabled: "#64748b",
  unknown: "#64748b",
  online: "#22c55e",
  offline: "#ef4444",
};

export function StatusDot({
  status,
  size = 8,
}: {
  status: string;
  size?: number;
}) {
  const color = statusColors[status] ?? statusColors.unknown;
  const isActive = status === "active" || status === "online";

  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: color,
          animation: isActive ? "statusPulse 2s ease-in-out infinite" : "none",
        }}
      />
      {isActive && (
        <span
          className="absolute rounded-full opacity-50"
          style={{
            inset: -2,
            border: `1px solid ${color}`,
            animation: "statusRing 2s ease-in-out infinite",
          }}
        />
      )}
    </span>
  );
}
