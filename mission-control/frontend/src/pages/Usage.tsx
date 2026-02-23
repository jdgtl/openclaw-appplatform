import { useState, useMemo } from "react";
import { PageShell } from "../components/PageShell.js";
import { AnimCounter } from "../components/AnimCounter.js";
import { usePolling } from "../lib/hooks.js";
import {
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
  costByModel?: Record<string, number>;
  totalCost?: number;
}

const RANGES = [
  { label: "24H", days: 1 },
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export function Usage() {
  const [days, setDays] = useState(7);
  const { data, loading } = usePolling<UsageData>(
    `/usage/summary?days=${days}`,
    60_000,
  );

  const modelEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byModel)
      .map(([model, stats]) => ({
        model,
        ...stats,
        total: stats.input + stats.output,
        cost: data.costByModel?.[model] ?? 0,
      }))
      .filter((m) => m.cost > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const totalRow = useMemo(() => {
    if (!modelEntries.length) return null;
    return modelEntries.reduce(
      (acc, m) => ({
        messages: acc.messages + m.messages,
        input: acc.input + m.input,
        output: acc.output + m.output,
        total: acc.total + m.total,
        cost: acc.cost + m.cost,
      }),
      { messages: 0, input: 0, output: 0, total: 0, cost: 0 },
    );
  }, [modelEntries]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byDay)
      .map(([day, stats]) => ({
        day: day.slice(5),
        input: stats.input,
        output: stats.output,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [data]);

  if (loading && !data) {
    return (
      <PageShell title="Usage">
        <div className="flex items-center justify-center h-64 text-text-dim">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Usage">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tokens" value={data?.totalTokens ?? 0} sub={`In: ${formatTokens(data?.totalInput ?? 0)} / Out: ${formatTokens(data?.totalOutput ?? 0)}`} />
        <StatCard label="Messages" value={data?.messageCount ?? 0} sub="with usage data" />
        <StatCard label="Models" value={modelEntries.length} sub="active in period" />
        <StatCard label="Est. Cost" value={data?.totalCost ?? 0} sub={`${days}d window`} isCurrency />
      </div>

      {/* Daily chart */}
      <div className="bg-card-bg border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text">Daily Usage</h3>
          {/* Timeframe pill */}
          <div className="flex rounded-lg bg-input-bg border border-input-border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                  days === r.days
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-dim hover:text-text"
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
                  stroke="var(--input-border)"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--input-border)" }}
                />
                <YAxis
                  tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--input-border)" }}
                  tickFormatter={formatTokens}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--modal-bg)",
                    border: "1px solid var(--input-border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--text)",
                  }}
                  formatter={(value: number) => formatTokens(value)}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }}
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
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  stackId="tokens"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-text-faint text-sm">
            No usage data for this period
          </div>
        )}
      </div>

      {/* Model breakdown */}
      <div className="bg-card-bg border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-text mb-3">Model Breakdown</h3>
        {modelEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-dim text-xs">
                  <th className="text-left py-2 font-medium">Model</th>
                  <th className="text-right py-2 font-medium">Messages</th>
                  <th className="text-right py-2 font-medium">Input</th>
                  <th className="text-right py-2 font-medium">Output</th>
                  <th className="text-right py-2 font-medium">Total</th>
                  <th className="text-right py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelEntries.map((m) => (
                  <tr
                    key={m.model}
                    className="border-b border-input-border last:border-0"
                  >
                    <td className="py-2 text-text-muted font-mono text-xs truncate max-w-[200px]">
                      {m.model}
                    </td>
                    <td className="py-2 text-right text-text-muted tabular-nums">
                      {m.messages}
                    </td>
                    <td className="py-2 text-right text-text-dim tabular-nums">
                      {formatTokens(m.input)}
                    </td>
                    <td className="py-2 text-right text-text-dim tabular-nums">
                      {formatTokens(m.output)}
                    </td>
                    <td className="py-2 text-right text-text font-medium tabular-nums">
                      {formatTokens(m.total)}
                    </td>
                    <td className="py-2 text-right tabular-nums font-mono">
                      {m.cost > 0 ? (
                        <span className="text-text">${m.cost.toFixed(4)}</span>
                      ) : (
                        <span className="text-success font-medium">Free</span>
                      )}
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                {totalRow && (
                  <tr className="border-t-2 border-border font-bold">
                    <td className="py-2 text-text text-xs">Totals</td>
                    <td className="py-2 text-right text-text tabular-nums">
                      {totalRow.messages}
                    </td>
                    <td className="py-2 text-right text-text tabular-nums">
                      {formatTokens(totalRow.input)}
                    </td>
                    <td className="py-2 text-right text-text tabular-nums">
                      {formatTokens(totalRow.output)}
                    </td>
                    <td className="py-2 text-right text-text tabular-nums">
                      {formatTokens(totalRow.total)}
                    </td>
                    <td className="py-2 text-right text-text tabular-nums font-mono">
                      ${totalRow.cost.toFixed(4)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-faint">No model data</p>
        )}
      </div>
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  isCurrency,
}: {
  label: string;
  value: number;
  sub: string;
  isCurrency?: boolean;
}) {
  return (
    <div className="bg-card-bg border border-border rounded-xl p-5">
      <h3 className="text-[11px] text-text-dim uppercase tracking-wider font-semibold mb-2">
        {label}
      </h3>
      <p className="text-2xl font-bold text-text tabular-nums">
        {isCurrency ? `$${value.toFixed(2)}` : <AnimCounter target={value} />}
      </p>
      <p className="text-xs text-text-dim mt-1">{sub}</p>
    </div>
  );
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
