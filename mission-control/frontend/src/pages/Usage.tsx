import { useState } from "react";
import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { usePolling } from "../lib/hooks.js";
import {
  BarChart3,
  MessageSquare,
  Cpu,
  Zap,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface UsageData {
  byModel: Record<string, { messages: number; input: number; output: number }>;
  byDay: Record<string, { input: number; output: number; messages: number }>;
  totalInput: number;
  totalOutput: number;
  totalTokens: number;
  messageCount: number;
}

const RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

export function Usage() {
  const [days, setDays] = useState(7);
  const { data, loading } = usePolling<UsageData>(
    `/usage/summary?days=${days}`,
    60_000,
  );

  if (loading && !data) {
    return (
      <PageShell title="Usage">
        <div className="flex items-center justify-center h-64 text-text-tertiary">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  const modelEntries = data
    ? Object.entries(data.byModel)
        .map(([model, stats]) => ({
          model,
          ...stats,
          total: stats.input + stats.output,
        }))
        .sort((a, b) => b.total - a.total)
    : [];

  const chartData = data
    ? Object.entries(data.byDay)
        .map(([day, stats]) => ({
          day: day.slice(5), // MM-DD
          input: stats.input,
          output: stats.output,
        }))
        .sort((a, b) => a.day.localeCompare(b.day))
    : [];

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <PageShell title="Usage">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard delay={0}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center">
              <Zap size={18} className="text-accent" />
            </div>
            <h3 className="text-sm font-medium text-text-primary">
              Total Tokens
            </h3>
          </div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {formatTokens(data?.totalTokens ?? 0)}
          </p>
          <div className="flex gap-4 mt-1 text-xs text-text-tertiary">
            <span>In: {formatTokens(data?.totalInput ?? 0)}</span>
            <span>Out: {formatTokens(data?.totalOutput ?? 0)}</span>
          </div>
        </GlassCard>

        <GlassCard delay={0.05}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-success/15 flex items-center justify-center">
              <MessageSquare size={18} className="text-success" />
            </div>
            <h3 className="text-sm font-medium text-text-primary">Messages</h3>
          </div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {data?.messageCount ?? 0}
          </p>
          <p className="text-xs text-text-tertiary mt-1">with usage data</p>
        </GlassCard>

        <GlassCard delay={0.1}>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center">
              <Cpu size={18} className="text-warning" />
            </div>
            <h3 className="text-sm font-medium text-text-primary">Models</h3>
          </div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {modelEntries.length}
          </p>
          <p className="text-xs text-text-tertiary mt-1">active in period</p>
        </GlassCard>
      </div>

      {/* Daily chart */}
      <GlassCard delay={0.15}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center">
              <BarChart3 size={18} className="text-accent" />
            </div>
            <h3 className="text-sm font-medium text-text-primary">
              Daily Usage
            </h3>
          </div>
          <div className="flex rounded-lg bg-surface-input border border-border-subtle p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                  days === r.days
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-subtle)"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                />
                <YAxis
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--border-subtle)" }}
                  tickFormatter={formatTokens}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-overlay)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                  formatter={(value: number) => formatTokens(value)}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }}
                />
                <Bar
                  dataKey="input"
                  name="Input"
                  fill="var(--accent)"
                  radius={[4, 4, 0, 0]}
                  stackId="tokens"
                />
                <Bar
                  dataKey="output"
                  name="Output"
                  fill="var(--success)"
                  radius={[4, 4, 0, 0]}
                  stackId="tokens"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-text-quaternary text-sm">
            No usage data for this period
          </div>
        )}
      </GlassCard>

      {/* Model breakdown */}
      <GlassCard delay={0.2}>
        <h3 className="text-sm font-medium text-text-primary mb-3">
          Model Breakdown
        </h3>
        {modelEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-separator text-text-tertiary text-xs">
                  <th className="text-left py-2 font-medium">Model</th>
                  <th className="text-right py-2 font-medium">Messages</th>
                  <th className="text-right py-2 font-medium">Input</th>
                  <th className="text-right py-2 font-medium">Output</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {modelEntries.map((m) => (
                  <tr
                    key={m.model}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="py-2 text-text-secondary font-mono text-xs truncate max-w-[200px]">
                      {m.model}
                    </td>
                    <td className="py-2 text-right text-text-secondary tabular-nums">
                      {m.messages}
                    </td>
                    <td className="py-2 text-right text-text-tertiary tabular-nums">
                      {formatTokens(m.input)}
                    </td>
                    <td className="py-2 text-right text-text-tertiary tabular-nums">
                      {formatTokens(m.output)}
                    </td>
                    <td className="py-2 text-right text-text-primary font-medium tabular-nums">
                      {formatTokens(m.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-quaternary">No model data</p>
        )}
      </GlassCard>
    </PageShell>
  );
}
