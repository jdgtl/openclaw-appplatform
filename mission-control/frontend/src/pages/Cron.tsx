import { useState, useCallback, useEffect, useMemo } from "react";
import { PageShell } from "../components/PageShell.js";
import { StatusDot } from "../components/StatusDot.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { Modal, FormLabel, FormInput, FormSelect, FormTextarea, ModalActions } from "../components/Modal.js";
import { usePolling } from "../lib/hooks.js";
import { fetchJSON, postJSON, deleteJSON } from "../lib/api.js";
import {
  Clock,
  Play,
  Trash2,
  Plus,
  Loader2,
  ToggleLeft,
  ToggleRight,
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
  category?: string;
  runCount?: number;
}

interface CronResponse {
  jobs?: CronJob[];
}

export function Cron() {
  const { data, loading, refetch } = usePolling<CronResponse>("/cron", 30_000);
  const jobs = data?.jobs ?? [];
  const [showAdd, setShowAdd] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const activeCount = jobs.filter((j) => j.enabled).length;
  const disabledCount = jobs.filter((j) => !j.enabled).length;

  // Group jobs by category
  const grouped = useMemo(() => {
    const map: Record<string, CronJob[]> = {};
    for (const job of jobs) {
      const cat = job.category || "General";
      if (!map[cat]) map[cat] = [];
      map[cat].push(job);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [jobs]);

  const handleToggle = useCallback(async (job: CronJob) => {
    setActionLoading(job.id);
    try {
      await postJSON(`/cron/${job.id}/toggle`, { enabled: !job.enabled });
      refetch();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleRun = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await postJSON(`/cron/${id}/run`, {});
      refetch();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget);
    try {
      await deleteJSON(`/cron/${deleteTarget}`);
      setDeleteTarget(null);
      refetch();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, [deleteTarget, refetch]);

  if (loading && !data) {
    return (
      <PageShell title="Cron Jobs">
        <div className="flex items-center justify-center h-64 text-text-dim">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Cron Jobs">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-[13px]">
          <span className="text-text-dim">{jobs.length} total</span>
          <span className="text-success">{activeCount} active</span>
          {disabledCount > 0 && (
            <span className="text-text-faint">{disabledCount} disabled</span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent-bg border border-accent-border rounded-lg text-xs font-medium text-accent hover:bg-accent/15 transition-colors"
        >
          <Plus size={14} />
          Add Job
        </button>
      </div>

      {/* Grouped job list */}
      {grouped.map(([category, catJobs]) => (
        <div key={category}>
          {/* Category header */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
              {category}
            </span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-text-dim">{catJobs.length}</span>
          </div>

          {/* Job rows */}
          <div className="flex flex-col gap-2 mb-6">
            {catJobs.map((job) => (
              <div
                key={job.id}
                className="bg-card-bg border border-border rounded-xl px-5 py-4 grid grid-cols-[1.5fr_1fr_1fr_auto_auto] items-center gap-5 transition-all duration-200 hover:border-border-hover"
              >
                {/* Name + schedule */}
                <div>
                  <div className="text-sm font-medium text-text mb-0.5">
                    {job.name || job.id}
                  </div>
                  {job.description && (
                    <div className="text-[11px] text-text-dim">{job.description}</div>
                  )}
                  <div className="text-xs font-mono text-accent mt-1">{job.schedule}</div>
                </div>

                {/* Last run */}
                <div>
                  <div className="text-[10px] text-text-faint uppercase tracking-wider mb-0.5">
                    Last Run
                  </div>
                  <div className="text-xs text-text-muted">
                    {job.lastRun ? new Date(job.lastRun).toLocaleString() : "—"}
                  </div>
                </div>

                {/* Next run */}
                <div>
                  <div className="text-[10px] text-text-faint uppercase tracking-wider mb-0.5">
                    Next Run
                  </div>
                  <div className="text-xs text-text-muted">
                    {job.nextRun ? new Date(job.nextRun).toLocaleString() : "—"}
                  </div>
                </div>

                {/* Run count */}
                <div className="text-center">
                  <div className="text-[10px] text-text-faint uppercase tracking-wider mb-0.5">
                    Runs
                  </div>
                  <div className="text-xs text-text-muted font-mono tabular-nums">
                    {job.runCount ?? "—"}
                  </div>
                </div>

                {/* Status + toggle */}
                <div className="flex items-center gap-2.5">
                  <StatusDot status={job.enabled ? "active" : "paused"} />
                  <button
                    onClick={() => handleToggle(job)}
                    disabled={actionLoading === job.id}
                    className="w-[30px] h-[30px] rounded-md border border-border bg-surface flex items-center justify-center text-text-muted hover:text-text hover:border-border-hover transition-colors"
                  >
                    {actionLoading === job.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : job.enabled ? (
                      <ToggleRight size={14} className="text-success" />
                    ) : (
                      <ToggleLeft size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => handleRun(job.id)}
                    disabled={actionLoading === job.id}
                    title="Run Now"
                    className="w-[30px] h-[30px] rounded-md border border-border bg-surface flex items-center justify-center text-text-muted hover:text-accent hover:border-border-hover transition-colors"
                  >
                    <Play size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(job.id)}
                    disabled={actionLoading === job.id}
                    title="Delete"
                    className="w-[30px] h-[30px] rounded-md border border-border bg-surface flex items-center justify-center text-text-muted hover:text-danger hover:border-border-hover transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {jobs.length === 0 && (
        <div className="text-center text-text-faint text-sm py-12">
          No cron jobs configured
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Cron Job"
        message="Delete this cron job? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Add Job Modal */}
      {showAdd && <AddJobModal onClose={() => { setShowAdd(false); refetch(); }} />}
    </PageShell>
  );
}

interface CronOptions {
  agents: string[];
  channels: string[];
  sessions: string[];
  models: { id: string; name: string; provider: string }[];
}

function AddJobModal({ onClose }: { onClose: () => void }) {
  const [opts, setOpts] = useState<CronOptions | null>(null);
  useEffect(() => {
    fetchJSON<CronOptions>("/cron/options").then(setOpts).catch(() => {});
  }, []);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [enabled, setEnabled] = useState(true);
  const [scheduleKind, setScheduleKind] = useState<"every" | "cron">("every");
  const [everyValue, setEveryValue] = useState("30");
  const [everyUnit, setEveryUnit] = useState("minutes");
  const [cronExpr, setCronExpr] = useState("");
  const [agentId, setAgentId] = useState("default");
  const [session, setSession] = useState("isolated");
  const [wakeMode, setWakeMode] = useState("now");
  const [model, setModel] = useState("");
  const [payloadKind, setPayloadKind] = useState("agentTurn");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isValid =
    name.trim() &&
    (scheduleKind === "every" ? Number(everyValue) > 0 : cronExpr.trim());

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    setError("");
    try {
      const schedule =
        scheduleKind === "every"
          ? { kind: "every", value: Number(everyValue), unit: everyUnit }
          : { kind: "cron", expr: cronExpr };

      await postJSON("/cron", {
        job: {
          name,
          description: description || undefined,
          category: category || undefined,
          agentId: agentId || undefined,
          enabled,
          schedule,
          sessionTarget: session,
          wakeMode,
          model: model || undefined,
          payloadKind,
          message: payloadKind === "agentTurn" ? message || undefined : undefined,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create cron job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New Cron Job">
      <div className="p-6 flex flex-col gap-5">
        {/* Identity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FormLabel>Name</FormLabel>
            <FormInput value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Daily summary" />
          </div>
          <div>
            <FormLabel>Description</FormLabel>
            <FormInput value={description} onChange={(e) => setDescription(e.currentTarget.value)} placeholder="Optional" />
          </div>
        </div>

        <div>
          <FormLabel>Category</FormLabel>
          <FormSelect value={category} onChange={(e) => setCategory(e.currentTarget.value)}>
            <option value="General">General</option>
            <option value="Reporting">Reporting</option>
            <option value="System">System</option>
            <option value="Monitoring">Monitoring</option>
            <option value="Automation">Automation</option>
          </FormSelect>
        </div>

        {/* Schedule */}
        <fieldset className="flex flex-col gap-3">
          <FormLabel accent>Schedule</FormLabel>
          <div className="flex gap-2">
            {(["every", "cron"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setScheduleKind(kind)}
                className={`text-xs px-4 py-1.5 rounded-md border transition-all ${
                  scheduleKind === kind
                    ? "border-accent bg-accent-bg text-accent"
                    : "border-border text-text-muted hover:text-text"
                }`}
              >
                {kind === "every" ? "Interval" : "Cron Expression"}
              </button>
            ))}
          </div>
          {scheduleKind === "every" ? (
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <div>
                <FormLabel>Every</FormLabel>
                <FormInput type="number" min={1} value={everyValue} onChange={(e) => setEveryValue(e.currentTarget.value)} />
              </div>
              <div>
                <FormLabel>Unit</FormLabel>
                <FormSelect value={everyUnit} onChange={(e) => setEveryUnit(e.currentTarget.value)}>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </FormSelect>
              </div>
            </div>
          ) : (
            <div>
              <FormLabel>Expression</FormLabel>
              <FormInput value={cronExpr} onChange={(e) => setCronExpr(e.currentTarget.value)} placeholder="0 9 * * *" />
              <span className="text-[10px] text-text-faint mt-1">min hour day month weekday</span>
            </div>
          )}
        </fieldset>

        {/* Execution */}
        <fieldset className="flex flex-col gap-3">
          <FormLabel accent>Execution</FormLabel>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FormLabel>Agent</FormLabel>
              <FormSelect value={agentId} onChange={(e) => setAgentId(e.currentTarget.value)}>
                {(opts?.agents ?? ["default"]).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </FormSelect>
            </div>
            <div>
              <FormLabel>Session</FormLabel>
              <FormSelect value={session} onChange={(e) => setSession(e.currentTarget.value)}>
                <option value="isolated">Isolated</option>
                <option value="last">Last</option>
                <option value="new">New</option>
              </FormSelect>
            </div>
            <div>
              <FormLabel>Wake mode</FormLabel>
              <FormSelect value={wakeMode} onChange={(e) => setWakeMode(e.currentTarget.value)}>
                <option value="now">Now</option>
                <option value="next">Next</option>
              </FormSelect>
            </div>
          </div>
          {opts?.models && opts.models.length > 0 && (
            <div>
              <FormLabel>Model override</FormLabel>
              <FormSelect value={model} onChange={(e) => setModel(e.currentTarget.value)}>
                <option value="">Agent default</option>
                {opts.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                ))}
              </FormSelect>
            </div>
          )}
        </fieldset>

        {/* Payload */}
        <fieldset className="flex flex-col gap-3">
          <FormLabel accent>Payload</FormLabel>
          <div>
            <FormLabel>Type</FormLabel>
            <FormSelect value={payloadKind} onChange={(e) => setPayloadKind(e.currentTarget.value)}>
              <option value="agentTurn">Agent turn</option>
              <option value="wake">Wake only</option>
            </FormSelect>
          </div>
          {payloadKind === "agentTurn" && (
            <div>
              <FormLabel>Agent message</FormLabel>
              <FormTextarea value={message} onChange={(e) => setMessage(e.currentTarget.value)} placeholder="Write a daily summary of recent activity" rows={3} />
            </div>
          )}
        </fieldset>

        {/* Enabled toggle */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setEnabled(!enabled)} className="text-text-muted hover:text-text transition-colors">
            {enabled ? <ToggleRight size={22} className="text-success" /> : <ToggleLeft size={22} />}
          </button>
          <span className="text-xs text-text">{enabled ? "Enabled" : "Disabled"}</span>
        </div>
      </div>
      {error && (
        <div className="mx-6 mb-2 px-3 py-2 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
          {error}
        </div>
      )}
      <ModalActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={saving ? "Creating..." : "Create Job"}
        disabled={saving || !isValid}
      />
    </Modal>
  );
}
