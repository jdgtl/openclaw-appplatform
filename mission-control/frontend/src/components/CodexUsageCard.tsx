import { usePolling } from "../lib/hooks.js";
import { ProgressBar } from "./ProgressBar.js";

interface UsageWindow {
  name: string;
  percentRemaining: number;
  percentUsed: number;
  resetAt: string | null;
}

interface CreditsInfo {
  remaining: number;
  hasCredits: boolean;
  unlimited: boolean;
}

interface CodexUsageData {
  available: boolean;
  reason?: string;
  windows?: UsageWindow[];
  credits?: CreditsInfo;
}

function usageColor(percentUsed: number): string {
  if (percentUsed >= 80) return "#ef4444";
  if (percentUsed >= 50) return "#f59e0b";
  return "#22c55e";
}

function formatReset(resetAt: string | null): string {
  if (!resetAt) return "";
  try {
    const reset = new Date(resetAt);
    const now = Date.now();
    const diffMs = reset.getTime() - now;
    if (diffMs <= 0) return "resetting...";

    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 60) return `resets in ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (diffH < 24) return `resets in ${diffH}h ${remMin}m`;

    return `resets ${reset.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  } catch {
    return "";
  }
}

function windowLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("5") && lower.includes("hour")) return "5-Hour Limit";
  if (lower.includes("week")) return "Weekly Limit";
  if (lower.includes("codex") && lower.includes("spark") && lower.includes("5")) return "Codex Spark 5h";
  if (lower.includes("codex") && lower.includes("spark") && lower.includes("week")) return "Codex Spark Weekly";
  if (lower.includes("code") && lower.includes("review")) return "Code Review";
  return name;
}

export function CodexUsageCard() {
  const { data } = usePolling<CodexUsageData>("/openai/usage", 60_000);

  if (!data) {
    return (
      <div className="bg-card-bg border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text mb-4">Codex Usage</h3>
        <p className="text-sm text-text-faint">Loading...</p>
      </div>
    );
  }

  if (!data.available) {
    const msg =
      data.reason === "token_expired"
        ? "OAuth token expired — re-authenticate in Control UI"
        : data.reason === "no_token"
          ? "No OpenAI Codex OAuth token configured"
          : "Usage data unavailable";
    return (
      <div className="bg-card-bg border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text mb-4">Codex Usage</h3>
        <p className="text-xs text-text-faint">{msg}</p>
      </div>
    );
  }

  const windows = data.windows ?? [];

  return (
    <div className="bg-card-bg border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: "#06b6d4" }}
        />
        <h3 className="text-sm font-semibold text-text">Codex Usage</h3>
      </div>

      {windows.length > 0 ? (
        <div className="flex flex-col gap-3.5">
          {windows.map((w, i) => {
            const pct = Math.round(w.percentUsed);
            const remaining = Math.round(w.percentRemaining);
            const color = usageColor(pct);
            return (
              <div key={i}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-xs text-text-dim">{windowLabel(w.name)}</span>
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{ color }}
                  >
                    {remaining}% remaining
                  </span>
                </div>
                <ProgressBar value={remaining} color={color} />
                {w.resetAt && (
                  <span className="text-[10px] text-text-faint mt-1 block">
                    {formatReset(w.resetAt)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-text-faint">No usage windows reported</p>
      )}

      {data.credits && (
        <div className="mt-3.5 pt-3 border-t border-border">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-text-dim">Credits</span>
            <span className="text-xs text-text font-mono tabular-nums">
              {data.credits.unlimited
                ? "Unlimited"
                : data.credits.remaining}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
