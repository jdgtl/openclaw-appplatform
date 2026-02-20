import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { usePolling } from "../lib/hooks.js";
import {
  Bot,
  MessageSquare,
  Cpu,
  Radio,
  Heart,
  Activity,
  Play,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { postJSON } from "../lib/api.js";
import { useState } from "react";

interface StatusData {
  agent: {
    name: string | null;
    status: string;
    version: string | null;
  };
  sessions: { count?: number; sessions?: { key: string }[] } | null;
  heartbeat: {
    lastRun?: string;
    nextRun?: string;
    status?: string;
  } | null;
  channels: Record<string, { enabled: boolean }> | null;
  models: {
    mode?: string;
    providers?: Record<
      string,
      { models?: { id: string; name: string; reasoning?: boolean }[] }
    >;
  } | null;
  activity: { file: string; content: string }[];
}

export function Dashboard() {
  const { data, loading } = usePolling<StatusData>("/status", 30_000);

  if (loading && !data) {
    return (
      <PageShell title="Dashboard">
        <div className="flex items-center justify-center h-64 text-text-tertiary">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  const sessionCount = data?.sessions?.sessions?.length ?? 0;
  const channels = data?.channels ?? {};
  const heartbeat = data?.heartbeat;
  const activity = data?.activity ?? [];
  const providers = data?.models?.providers ?? {};
  const providerEntries = Object.entries(providers)
    .map(([key, p]) => ({
      key,
      label: providerLabel(key),
      models: p.models ?? [],
      reasoning: (p.models ?? []).filter((m) => m.reasoning).length,
    }))
    .filter((p) => p.models.length > 0);
  const totalModels = providerEntries.reduce((n, p) => n + p.models.length, 0);

  return (
    <PageShell title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Agent Status */}
        <GlassCard delay={0}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center">
              <Bot size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-text-primary">Agent</h3>
              <p className="text-xs text-text-tertiary">
                {data?.agent?.version ?? "unknown"}
              </p>
            </div>
          </div>
          <p className="text-lg font-semibold text-text-primary mb-1">
            {data?.agent?.name ?? "Unnamed"}
          </p>
          <StatusBadge status={data?.agent?.status ?? "error"} />
        </GlassCard>

        {/* Sessions */}
        <GlassCard delay={0.05}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center">
              <MessageSquare size={18} className="text-success" />
            </div>
            <h3 className="text-sm font-medium text-text-primary">Sessions</h3>
          </div>
          <p className="text-3xl font-bold text-text-primary tabular-nums">
            {sessionCount}
          </p>
          <p className="text-xs text-text-tertiary mt-1">active sessions</p>
        </GlassCard>

        {/* Channels */}
        <GlassCard delay={0.1}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center">
              <Radio size={18} className="text-warning" />
            </div>
            <h3 className="text-sm font-medium text-text-primary">Channels</h3>
          </div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(channels).length > 0 ? (
              Object.entries(channels).map(([name, ch]) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-text-secondary capitalize">{name}</span>
                  <StatusBadge
                    status={ch.enabled ? "active" : "disabled"}
                    label={ch.enabled ? "on" : "off"}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-text-quaternary">No channels configured</p>
            )}
          </div>
        </GlassCard>

        {/* Heartbeat */}
        <GlassCard delay={0.15}>
          <HeartbeatCard heartbeat={heartbeat ?? null} />
        </GlassCard>

        {/* Models */}
        <GlassCard delay={0.2}>
          <ModelsCard providers={providerEntries} total={totalModels} />
        </GlassCard>

        {/* Activity Feed */}
        <GlassCard delay={0.25} className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center">
              <Activity size={18} className="text-success" />
            </div>
            <h3 className="text-sm font-medium text-text-primary">
              Recent Activity
            </h3>
          </div>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {activity.length > 0 ? (
              activity.map((entry) => (
                <div key={entry.file} className="text-xs">
                  <p className="text-text-tertiary font-medium mb-0.5">
                    {entry.file}
                  </p>
                  <p className="text-text-quaternary line-clamp-3 whitespace-pre-wrap">
                    {entry.content.slice(0, 200)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-quaternary">No recent activity</p>
            )}
          </div>
        </GlassCard>
      </div>
    </PageShell>
  );
}

function HeartbeatCard({
  heartbeat,
}: {
  heartbeat: StatusData["heartbeat"];
}) {
  const [running, setRunning] = useState(false);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await postJSON("/system/heartbeat", {});
    } catch {
      // toast or ignore
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-danger/15 flex items-center justify-center">
          <Heart size={18} className="text-danger" />
        </div>
        <h3 className="text-sm font-medium text-text-primary">Heartbeat</h3>
      </div>
      {heartbeat ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Last</span>
            <span className="text-text-secondary">
              {heartbeat.lastRun
                ? new Date(heartbeat.lastRun).toLocaleTimeString()
                : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Next</span>
            <span className="text-text-secondary">
              {heartbeat.nextRun
                ? new Date(heartbeat.nextRun).toLocaleTimeString()
                : "—"}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-quaternary">
          Not yet active — set HEARTBEAT_INTERVAL to enable
        </p>
      )}
      <button
        onClick={handleRunNow}
        disabled={running}
        className="mt-3 flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
      >
        {running ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Play size={12} />
        )}
        Run Now
      </button>
    </>
  );
}

interface ProviderEntry {
  key: string;
  label: string;
  models: { id: string; name: string; reasoning?: boolean }[];
  reasoning: number;
}

function ModelsCard({
  providers,
  total,
}: {
  providers: ProviderEntry[];
  total: number;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center">
          <Cpu size={18} className="text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-text-primary">Models</h3>
          {total > 0 && (
            <p className="text-xs text-text-tertiary">
              {total} across {providers.length} provider
              {providers.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {providers.length > 0 ? (
          providers.map((p) => {
            const isOpen = expanded === p.key;
            return (
              <div key={p.key}>
                <button
                  onClick={() => setExpanded(isOpen ? null : p.key)}
                  className="w-full flex items-center justify-between text-sm py-1 rounded hover:bg-surface-control/50 transition-colors -mx-1 px-1"
                >
                  <div className="flex items-center gap-1.5">
                    <ChevronRight
                      size={12}
                      className={`text-text-quaternary transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className="text-text-secondary font-medium">
                      {p.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-quaternary tabular-nums">
                      {p.models.length}
                    </span>
                    {p.reasoning > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent tabular-nums">
                        {p.reasoning} R
                      </span>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="ml-5 mt-0.5 mb-1 flex flex-col gap-0.5">
                    {p.models.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-xs py-0.5"
                      >
                        <span className="text-text-tertiary truncate mr-2">
                          {m.name}
                        </span>
                        {m.reasoning && (
                          <span className="text-[9px] px-1 py-px rounded bg-accent/10 text-accent/70 shrink-0">
                            R
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-text-quaternary">No models configured</p>
        )}
      </div>
    </>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gradient: "Gradient",
  google: "Google",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  meta: "Meta",
};

function providerLabel(key: string): string {
  return PROVIDER_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
