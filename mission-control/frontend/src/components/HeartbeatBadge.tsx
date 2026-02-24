import { usePolling } from "../lib/hooks.js";

interface StatusData {
  heartbeatInterval: string | null;
}

export function HeartbeatBadge() {
  const { data } = usePolling<StatusData>("/status", 30_000);
  const interval = data?.heartbeatInterval;
  const active = !!interval;

  return (
    <div className="flex items-center gap-1.5" title={active ? `Heartbeat every ${interval}` : "Heartbeat off"}>
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        className={active ? "hb-icon-active" : ""}
        style={{ opacity: active ? 1 : 0.35 }}
      >
        {/* Mini ECG trace: flat — spike — flat */}
        <path
          d="M1 13h5l2-5 3 10 2-8 1.5 3H22"
          stroke={active ? "#ef4444" : "var(--text-dim)"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="text-[11px] tabular-nums"
        style={{ color: active ? "#ef4444" : "var(--text-faint)" }}
      >
        {active ? interval : "off"}
      </span>
    </div>
  );
}
