import { useState, useCallback } from "react";
import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { usePolling } from "../lib/hooks.js";
import { postJSON, deleteJSON } from "../lib/api.js";
import {
  Clock,
  Play,
  Trash2,
  Plus,
  X,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  message?: string;
  sessionTarget?: string;
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
                </div>
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

function AddJobModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !schedule) return;
    setSaving(true);
    try {
      await postJSON("/cron", {
        job: { name, schedule, message: message || undefined, enabled: true },
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
      <div className="glass-window w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-separator">
          <h2 className="text-sm font-semibold text-text-primary">
            Add Cron Job
          </h2>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-tertiary">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily summary"
              className="bg-surface-input text-sm text-text-primary rounded-lg px-3 py-2 outline-none border border-border-subtle focus:border-accent transition-colors"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-tertiary">
              Schedule (cron expression)
            </span>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="0 9 * * *"
              className="bg-surface-input text-sm text-text-primary font-mono rounded-lg px-3 py-2 outline-none border border-border-subtle focus:border-accent transition-colors"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-tertiary">
              Agent prompt
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a daily summary of recent activity"
              rows={3}
              className="bg-surface-input text-sm text-text-primary rounded-lg px-3 py-2 outline-none border border-border-subtle focus:border-accent transition-colors resize-none"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-text-secondary px-4 py-2 rounded-lg hover:bg-surface-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name || !schedule}
              className="text-sm text-white bg-accent px-4 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
