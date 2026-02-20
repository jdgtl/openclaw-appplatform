import { useState, useCallback, useEffect } from "react";
import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { usePolling } from "../lib/hooks.js";
import { fetchJSON, postJSON, deleteJSON } from "../lib/api.js";
import {
  Clock,
  Play,
  Trash2,
  Plus,
  X,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
} from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  description?: string;
  agentId?: string;
  schedule: string;
  scheduleKind?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  message?: string;
  sessionTarget?: string;
  wakeMode?: string;
  delivery?: string;
  timeout?: number;
  channel?: string;
  to?: string;
}

interface CronResponse {
  jobs?: CronJob[];
}

export function Cron() {
  const { data, loading } = usePolling<CronResponse>("/cron", 30_000);
  const jobs = data?.jobs ?? [];
  const [showAdd, setShowAdd] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const activeCount = jobs.filter((j) => j.enabled).length;
  const disabledCount = jobs.filter((j) => !j.enabled).length;

  const handleToggle = useCallback(async (job: CronJob) => {
    setActionLoading(job.id);
    try {
      await postJSON(`/cron/${job.id}/toggle`, { enabled: !job.enabled });
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleRun = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await postJSON(`/cron/${id}/run`, {});
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this cron job?")) return;
    setActionLoading(id);
    try {
      await deleteJSON(`/cron/${id}`);
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, []);

  if (loading && !data) {
    return (
      <PageShell title="Cron Jobs">
        <div className="flex items-center justify-center h-64 text-text-tertiary">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Cron Jobs">
      {/* Summary bar */}
      <GlassCard>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-accent" />
            <span className="text-sm text-text-secondary">
              <strong className="text-text-primary">{jobs.length}</strong> total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm text-text-secondary">
              <strong className="text-text-primary">{activeCount}</strong>{" "}
              active
            </span>
          </div>
          {disabledCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-text-quaternary" />
              <span className="text-sm text-text-secondary">
                <strong className="text-text-primary">{disabledCount}</strong>{" "}
                disabled
              </span>
            </div>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Plus size={14} />
            Add Job
          </button>
        </div>
      </GlassCard>

      {/* Job list */}
      <div className="flex flex-col gap-2">
        {jobs.map((job) => (
          <GlassCard key={job.id} className="!p-4">
            <div className="flex items-center gap-4">
              {/* Toggle */}
              <button
                onClick={() => handleToggle(job)}
                disabled={actionLoading === job.id}
                className="shrink-0 text-text-secondary hover:text-text-primary transition-colors"
              >
                {job.enabled ? (
                  <ToggleRight size={22} className="text-success" />
                ) : (
                  <ToggleLeft size={22} />
                )}
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {job.name || job.id}
                  </p>
                  <StatusBadge
                    status={job.enabled ? "active" : "disabled"}
                    label={job.enabled ? "active" : "off"}
                  />
                  {job.sessionTarget && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-control text-text-quaternary">
                      {job.sessionTarget}
                    </span>
                  )}
                </div>
                {job.description && (
                  <p className="text-xs text-text-secondary mt-0.5 truncate">
                    {job.description}
                  </p>
                )}
                <p className="text-xs text-text-tertiary font-mono mt-0.5">
                  {job.schedule}
                </p>
                <div className="flex gap-4 mt-1 text-xs text-text-quaternary">
                  {job.lastRun && (
                    <span>
                      Last: {new Date(job.lastRun).toLocaleString()}
                    </span>
                  )}
                  {job.nextRun && (
                    <span>
                      Next: {new Date(job.nextRun).toLocaleString()}
                    </span>
                  )}
                </div>
                {job.message && (
                  <p className="text-xs text-text-quaternary mt-1 truncate">
                    {job.message}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleRun(job.id)}
                  disabled={actionLoading === job.id}
                  title="Run Now"
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-surface-control transition-colors"
                >
                  {actionLoading === job.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  disabled={actionLoading === job.id}
                  title="Delete"
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-surface-control transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}

        {jobs.length === 0 && (
          <div className="text-center text-text-quaternary text-sm py-12">
            No cron jobs configured
          </div>
        )}
      </div>

      {/* Add Job Modal */}
      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} />}
    </PageShell>
  );
}

const INPUT =
  "bg-surface-input text-sm text-text-primary rounded-lg px-3 py-2 outline-none border border-border-subtle focus:border-accent transition-colors w-full";
const LABEL = "text-xs text-text-tertiary font-medium";
const SECTION =
  "text-[11px] font-semibold text-text-quaternary uppercase tracking-wider";

interface CronOptions {
  agents: string[];
  channels: string[];
  sessions: string[];
  models: { id: string; name: string; provider: string }[];
}

function AddJobModal({ onClose }: { onClose: () => void }) {
  // Dynamic options from server
  const [opts, setOpts] = useState<CronOptions | null>(null);
  useEffect(() => {
    fetchJSON<CronOptions>("/cron/options").then(setOpts).catch(() => {});
  }, []);

  // Identity
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);

  // Schedule
  const [scheduleKind, setScheduleKind] = useState<"every" | "cron">("every");
  const [everyValue, setEveryValue] = useState("30");
  const [everyUnit, setEveryUnit] = useState("minutes");
  const [cronExpr, setCronExpr] = useState("");

  // Execution
  const [agentId, setAgentId] = useState("default");
  const [session, setSession] = useState("isolated");
  const [wakeMode, setWakeMode] = useState("now");
  const [model, setModel] = useState("");

  // Payload
  const [payloadKind, setPayloadKind] = useState("agentTurn");
  const [message, setMessage] = useState("");

  // Delivery (advanced)
  const [showDelivery, setShowDelivery] = useState(false);
  const [delivery, setDelivery] = useState("announce-summary");
  const [timeoutSec, setTimeoutSec] = useState("");
  const [channel, setChannel] = useState("last");
  const [to, setTo] = useState("");

  const [saving, setSaving] = useState(false);

  const isValid =
    name.trim() &&
    (scheduleKind === "every" ? Number(everyValue) > 0 : cronExpr.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const schedule =
        scheduleKind === "every"
          ? { kind: "every", value: Number(everyValue), unit: everyUnit }
          : { kind: "cron", expr: cronExpr };

      await postJSON("/cron", {
        job: {
          name,
          description: description || undefined,
          agentId: agentId || undefined,
          enabled,
          schedule,
          sessionTarget: session,
          wakeMode,
          model: model || undefined,
          payloadKind,
          message:
            payloadKind === "agentTurn" ? message || undefined : undefined,
          delivery: showDelivery ? delivery || undefined : undefined,
          timeout: showDelivery && timeoutSec ? Number(timeoutSec) : undefined,
          channel: showDelivery ? channel || undefined : undefined,
          to: showDelivery && to ? to : undefined,
        },
      });
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-window w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-separator shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">
            New Cron Job
          </h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <form
          onSubmit={handleSubmit}
          className="p-5 flex flex-col gap-5 overflow-y-auto"
        >
          {/* ── Identity ── */}
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 flex-1">
              <span className={LABEL}>Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Daily summary"
                className={INPUT}
                required
              />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className={LABEL}>Description</span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className={INPUT}
              />
            </label>
          </div>

          {/* ── Schedule ── */}
          <fieldset className="flex flex-col gap-3">
            <legend className={SECTION}>Schedule</legend>
            <div className="flex rounded-lg bg-surface-input border border-border-subtle p-0.5 w-fit">
              {(["every", "cron"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setScheduleKind(kind)}
                  className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                    scheduleKind === kind
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  {kind === "every" ? "Interval" : "Cron Expression"}
                </button>
              ))}
            </div>
            {scheduleKind === "every" ? (
              <div className="flex gap-3 items-end">
                <label className="flex flex-col gap-1 w-24">
                  <span className={LABEL}>Every</span>
                  <input
                    type="number"
                    min={1}
                    value={everyValue}
                    onChange={(e) => setEveryValue(e.target.value)}
                    className={INPUT}
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1">
                  <span className={LABEL}>Unit</span>
                  <select
                    value={everyUnit}
                    onChange={(e) => setEveryUnit(e.target.value)}
                    className={INPUT}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </label>
              </div>
            ) : (
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Expression</span>
                <input
                  type="text"
                  value={cronExpr}
                  onChange={(e) => setCronExpr(e.target.value)}
                  placeholder="0 9 * * *"
                  className={`${INPUT} font-mono`}
                />
                <span className="text-[10px] text-text-quaternary mt-0.5">
                  min hour day month weekday
                </span>
              </label>
            )}
          </fieldset>

          {/* ── Execution ── */}
          <fieldset className="flex flex-col gap-3">
            <legend className={SECTION}>Execution</legend>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Agent</span>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className={INPUT}
                >
                  {(opts?.agents ?? ["default"]).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Session</span>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className={INPUT}
                >
                  <option value="isolated">Isolated</option>
                  <option value="last">Last</option>
                  <option value="new">New</option>
                  {(opts?.sessions ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Wake mode</span>
                <select
                  value={wakeMode}
                  onChange={(e) => setWakeMode(e.target.value)}
                  className={INPUT}
                >
                  <option value="now">Now</option>
                  <option value="next">Next</option>
                </select>
              </label>
            </div>
            {opts?.models && opts.models.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Model override</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={INPUT}
                >
                  <option value="">Agent default</option>
                  {opts.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>

          {/* ── Payload ── */}
          <fieldset className="flex flex-col gap-3">
            <legend className={SECTION}>Payload</legend>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Type</span>
              <select
                value={payloadKind}
                onChange={(e) => setPayloadKind(e.target.value)}
                className={INPUT}
              >
                <option value="agentTurn">Agent turn</option>
                <option value="wake">Wake only</option>
              </select>
            </label>
            {payloadKind === "agentTurn" && (
              <label className="flex flex-col gap-1">
                <span className={LABEL}>Agent message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write a daily summary of recent activity"
                  rows={3}
                  className={`${INPUT} resize-none`}
                />
              </label>
            )}
          </fieldset>

          {/* ── Delivery (collapsible) ── */}
          <div>
            <button
              type="button"
              onClick={() => setShowDelivery(!showDelivery)}
              className={`flex items-center gap-1.5 ${SECTION} hover:text-text-secondary transition-colors`}
            >
              <ChevronRight
                size={12}
                className={`transition-transform ${showDelivery ? "rotate-90" : ""}`}
              />
              Delivery Options
            </button>
            {showDelivery && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className={LABEL}>Mode</span>
                    <select
                      value={delivery}
                      onChange={(e) => setDelivery(e.target.value)}
                      className={INPUT}
                    >
                      <option value="announce-summary">Announce summary</option>
                      <option value="direct">Direct</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={LABEL}>Timeout (seconds)</span>
                    <input
                      type="number"
                      min={0}
                      value={timeoutSec}
                      onChange={(e) => setTimeoutSec(e.target.value)}
                      placeholder="300"
                      className={INPUT}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className={LABEL}>Channel</span>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      className={INPUT}
                    >
                      <option value="last">Last</option>
                      {(opts?.channels ?? [])
                        .filter((c) => c !== "last")
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={LABEL}>To</span>
                    <input
                      type="text"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="+1555... or chat id"
                      className={INPUT}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between pt-3 border-t border-separator">
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              {enabled ? (
                <ToggleRight size={22} className="text-success" />
              ) : (
                <ToggleLeft size={22} />
              )}
              <span className="text-xs">
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-text-secondary px-4 py-2 rounded-lg hover:bg-surface-control transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !isValid}
                className="text-sm text-white bg-accent px-4 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Create Job"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
