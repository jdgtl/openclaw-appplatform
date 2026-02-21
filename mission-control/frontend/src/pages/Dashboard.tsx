import { PageShell } from "../components/PageShell.js";
import { StatusDot } from "../components/StatusDot.js";
import { AnimCounter } from "../components/AnimCounter.js";
import { Sparkline } from "../components/Sparkline.js";
import { usePolling } from "../lib/hooks.js";
import { postJSON } from "../lib/api.js";
import { useState, useMemo, useRef } from "react";
import {
  Loader2,
  Play,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface StatusData {
  agent: {
    name: string | null;
    status: string;
    version: string | null;
    model: string | null;
  };
  sessions: { count?: number; sessions?: { key: string }[] } | null;
  heartbeat: {
    lastRun?: string;
    nextRun?: string;
    status?: string;
  } | null;
  channels: Record<string, { enabled: boolean; status?: string }> | null;
  models: {
    mode?: string;
    providers?: Record<
      string,
      { models?: { id: string; name: string; reasoning?: boolean }[] }
    >;
  } | null;
  providers?: { name: string; models: number; status: string }[];
  activity: { file: string; content: string }[];
}

interface UsageData {
  byModel: Record<string, { messages: number; input: number; output: number }>;
  byDay: Record<string, { input: number; output: number; messages: number }>;
  totalInput: number;
  totalOutput: number;
  totalTokens: number;
  messageCount: number;
  costByModel?: Record<string, number>;
  totalCost?: number;
}

interface SystemInfo {
  nodeVersion: string;
  uptime: number;
  mcVersion: string;
  pid: number;
  memory: { rss: number; heapUsed: number; heapTotal: number };
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

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: "#6366f1",
  OpenAI: "#06b6d4",
  Gradient: "#f59e0b",
  Google: "#22c55e",
  Mistral: "#ec4899",
  DeepSeek: "#8b5cf6",
  Meta: "#f97316",
};

const MODEL_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#ec4899", "#22c55e", "#8b5cf6"];

const CHANNEL_ICONS: Record<string, string> = {
  slack: "\u{1F4AC}",
  whatsapp: "\u{1F4F1}",
  discord: "\u{1F3AE}",
  telegram: "\u{2709}\uFE0F",
  mc: "\u{1F5A5}\uFE0F",
};

function makeSparkData(base: number) {
  return Array.from({ length: 20 }, () => ({ v: base + Math.random() * base * 0.6 }));
}

export function Dashboard() {
  const { data, loading } = usePolling<StatusData>("/status", 30_000);
  const { data: usageData } = usePolling<UsageData>("/usage/summary?days=14", 60_000);
  const { data: sysInfo } = usePolling<SystemInfo>("/system/info", 30_000);

  // Stable spark data — only regenerated when base values change significantly
  const msgSparkRef = useRef(makeSparkData(30));
  const costSparkRef = useRef(makeSparkData(2));

  const sessionCount = data?.sessions?.sessions?.length ?? 0;
  const channels = data?.channels ?? {};
  const totalCost = usageData?.totalCost ?? 0;
  const todayMessages = useMemo(() => {
    if (!usageData?.byDay) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return usageData.byDay[today]?.messages ?? 0;
  }, [usageData]);

  const chartData = useMemo(() => {
    if (!usageData?.byDay) return [];
    return Object.entries(usageData.byDay)
      .map(([day, stats]) => ({
        date: day.slice(5),
        input: stats.input,
        output: stats.output,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [usageData]);

  const costData = useMemo(() => {
    if (!usageData?.costByModel) return [];
    return Object.entries(usageData.costByModel)
      .map(([model, cost], i) => ({
        name: model.split("-").slice(0, 2).join("-"),
        cost: parseFloat(cost.toFixed(2)),
        color: MODEL_COLORS[i % MODEL_COLORS.length],
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 6);
  }, [usageData]);

  // Derive providers from status data
  const providers = useMemo(() => {
    if (data?.providers) return data.providers;
    const p = data?.models?.providers ?? {};
    return Object.entries(p)
      .map(([key, val]) => ({
        name: PROVIDER_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
        models: val.models?.length ?? 0,
        status: "active",
      }))
      .filter((p) => p.models > 0);
  }, [data]);

  if (loading && !data) {
    return (
      <PageShell title="Dashboard">
        <div className="flex items-center justify-center h-64 text-text-dim">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Dashboard">
      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Agent Status"
          value={data?.agent?.name ?? "Offline"}
          sub={data?.agent?.model ?? data?.agent?.version ?? "—"}
          accent="#22c55e"
          status={data?.agent?.status}
        />
        <StatCard
          label="Active Sessions"
          value={sessionCount}
          sub={`${Object.keys(channels).length} channels`}
          accent="#06b6d4"
        />
        <StatCard
          label="Messages Today"
          value={todayMessages}
          sub={`${usageData?.messageCount ?? 0} total`}
          accent="#6366f1"
          spark={msgSparkRef.current}
          sparkColor="#6366f1"
        />
        <StatCard
          label="Est. Cost"
          value={`$${totalCost.toFixed(2)}`}
          sub={`${Object.keys(usageData?.byModel ?? {}).length} models active`}
          accent="#f59e0b"
          spark={costSparkRef.current}
          sparkColor="#f59e0b"
        />
      </div>

      {/* Row 2: Activity Chart + Cost Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Overview */}
        <div className="lg:col-span-2 bg-card-bg border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-text">Activity Overview</h3>
            <div className="flex gap-3">
              {[{ c: "#06b6d4", l: "Input" }, { c: "#6366f1", l: "Output" }].map((d) => (
                <span key={d.l} className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.c }} />
                  {d.l}
                </span>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "var(--text-faint)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "var(--text-faint)" }}
                    width={40}
                    tickFormatter={formatTokens}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#e2e8f0",
                      backdropFilter: "blur(12px)",
                    }}
                    formatter={(value: number) => formatTokens(value)}
                  />
                  <Area type="monotone" dataKey="input" name="Input" stroke="#06b6d4" strokeWidth={2} fill="url(#gI)" dot={false} />
                  <Area type="monotone" dataKey="output" name="Output" stroke="#6366f1" strokeWidth={2} fill="url(#gO)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-faint text-sm">
              No usage data yet
            </div>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="bg-card-bg border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-text mb-1">Cost Breakdown</h3>
          <p className="text-2xl font-bold text-warning mb-4 tabular-nums font-mono">
            ${totalCost.toFixed(2)}
          </p>
          {costData.length > 0 ? (
            <>
              <div className="flex justify-center mb-4">
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie
                      data={costData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={55}
                      dataKey="cost"
                      stroke="none"
                    >
                      {costData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {costData.map((m, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: m.color }} />
                  <span className="text-[11px] text-text-muted flex-1 truncate">{m.name}</span>
                  <span className="text-xs font-semibold text-text font-mono tabular-nums">
                    ${m.cost.toFixed(2)}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div className="flex items-center justify-center h-32 text-text-faint text-sm">
              No cost data
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Channels + Providers + System */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Channels */}
        <div className="bg-card-bg border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text mb-4">Channels</h3>
          {Object.entries(channels).length > 0 ? (
            <div className="flex flex-col">
              {Object.entries(channels).map(([name, ch], i, arr) => (
                <div
                  key={name}
                  className={`flex items-center gap-3 py-2.5 ${
                    i < arr.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <span className="text-lg">{CHANNEL_ICONS[name] ?? "\u{1F4AC}"}</span>
                  <span className="flex-1 text-[13px] text-text capitalize">{name}</span>
                  <StatusDot status={ch.enabled ? "active" : "paused"} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-faint">No channels configured</p>
          )}
        </div>

        {/* Providers */}
        <div className="bg-card-bg border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text mb-4">Providers</h3>
          {providers.length > 0 ? (
            <div className="flex flex-col">
              {providers.map((p, i) => {
                const color = PROVIDER_COLORS[p.name] ?? "#06b6d4";
                return (
                  <div
                    key={p.name}
                    className={`flex items-center gap-3 py-2.5 ${
                      i < providers.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="flex-1 text-[13px] text-text">{p.name}</span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded"
                      style={{ color, background: `${color}15` }}
                    >
                      {p.models}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-faint">No providers configured</p>
          )}
        </div>

        {/* System */}
        <SystemCard sysInfo={sysInfo ?? null} heartbeat={data?.heartbeat ?? null} />
      </div>
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  status,
  spark,
  sparkColor,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent: string;
  status?: string;
  spark?: { v: number }[];
  sparkColor?: string;
}) {
  return (
    <div
      className="bg-card-bg border border-border rounded-xl p-5 relative overflow-hidden transition-all duration-200 cursor-default hover:-translate-y-px"
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${accent}44`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "";
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-[11px] text-text-dim uppercase tracking-wider font-semibold">
          {label}
        </span>
        {status && <StatusDot status={status} />}
      </div>
      <div className="text-[28px] font-bold text-text tracking-tight">
        {typeof value === "number" ? <AnimCounter target={value} /> : value}
      </div>
      <div className="text-xs text-text-dim mt-1">{sub}</div>
      {spark && sparkColor && (
        <div className="absolute bottom-0 left-0 right-0 h-10 opacity-50">
          <Sparkline data={spark} color={sparkColor} height={40} />
        </div>
      )}
    </div>
  );
}

function SystemCard({
  sysInfo,
  heartbeat,
}: {
  sysInfo: SystemInfo | null;
  heartbeat: StatusData["heartbeat"];
}) {
  const [running, setRunning] = useState(false);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await postJSON("/system/heartbeat", {});
    } catch {
      // ignore
    } finally {
      setRunning(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h` : `${h}h`;
  };

  const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const rows = sysInfo
    ? [
        { k: "Node", v: sysInfo.nodeVersion },
        { k: "MC Version", v: sysInfo.mcVersion },
        { k: "Uptime", v: formatUptime(sysInfo.uptime) },
        { k: "Memory", v: formatBytes(sysInfo.memory.rss) },
        { k: "Heap", v: `${formatBytes(sysInfo.memory.heapUsed)} / ${formatBytes(sysInfo.memory.heapTotal)}` },
      ]
    : [];

  return (
    <div className="bg-card-bg border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">System</h3>
        {heartbeat && (
          <button
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
          >
            {running ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Play size={10} />
            )}
            Heartbeat
          </button>
        )}
      </div>
      {rows.length > 0 ? (
        <div className="flex flex-col">
          {rows.map((s, i) => (
            <div
              key={s.k}
              className={`flex justify-between py-[7px] ${
                i < rows.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-xs text-text-dim">{s.k}</span>
              <span className="text-xs text-text font-mono">{s.v}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-faint">Loading...</p>
      )}
    </div>
  );
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
