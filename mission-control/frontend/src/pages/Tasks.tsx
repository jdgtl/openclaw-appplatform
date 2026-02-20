import { useState, useEffect, useCallback } from "react";
import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { usePolling } from "../lib/hooks.js";
import { postJSON, putJSON, deleteJSON } from "../lib/api.js";
import {
  KanbanSquare,
  Plus,
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

type TaskStatus = "queue" | "in_progress" | "needs_human" | "completed";
type Priority = "low" | "medium" | "high";

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: Priority;
  labels?: string[];
  createdAt: string;
  updatedAt: string;
}

interface TasksData {
  version: number;
  tasks: TaskItem[];
}

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "queue", label: "Queue", color: "text-text-tertiary" },
  { status: "in_progress", label: "In Progress", color: "text-accent" },
  { status: "needs_human", label: "Needs Human", color: "text-warning" },
  { status: "completed", label: "Completed", color: "text-success" },
];

const STATUS_ORDER: TaskStatus[] = ["queue", "in_progress", "needs_human", "completed"];

const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-danger/15 text-danger",
  medium: "bg-warning/15 text-warning",
  low: "bg-surface-control text-text-quaternary",
};

export function Tasks() {
  const { data, loading } = usePolling<TasksData>("/tasks", 15_000);
  const tasks = data?.tasks ?? [];
  const [showNew, setShowNew] = useState(false);
  const [editTask, setEditTask] = useState<TaskItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleMove = useCallback(async (id: string, status: TaskStatus) => {
    setActionLoading(id);
    try {
      await putJSON(`/tasks/${id}/move`, { status });
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteJSON(`/tasks/${deleteTarget}`);
      setDeleteTarget(null);
    } catch {
      // ignore
    }
  }, [deleteTarget]);

  const handleCreate = async (task: { title: string; description?: string; status: TaskStatus; priority?: Priority; labels?: string[] }) => {
    try {
      await postJSON("/tasks", task);
      setShowNew(false);
    } catch {
      // ignore
    }
  };

  const handleUpdate = async (task: Partial<TaskItem> & { id: string }) => {
    try {
      await putJSON(`/tasks/${task.id}`, task);
      setEditTask(null);
    } catch {
      // ignore
    }
  };

  if (loading && !data) {
    return (
      <PageShell title="Tasks">
        <div className="flex items-center justify-center h-64 text-text-tertiary">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Tasks">
      {/* Summary bar */}
      <GlassCard>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <KanbanSquare size={16} className="text-accent" />
            <span className="text-sm text-text-secondary">
              <strong className="text-text-primary">{tasks.length}</strong> total
            </span>
          </div>
          {COLUMNS.map((col) => {
            const count = tasks.filter((t) => t.status === col.status).length;
            if (count === 0) return null;
            return (
              <div key={col.status} className="flex items-center gap-2">
                <span className={`text-sm ${col.color}`}>
                  <strong className="text-text-primary">{count}</strong>{" "}
                  {col.label.toLowerCase()}
                </span>
              </div>
            );
          })}
          <button
            onClick={() => setShowNew(true)}
            className="ml-auto flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Plus size={14} />
            New Task
          </button>
        </div>
      </GlassCard>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-2 min-h-[400px]">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          const colIdx = STATUS_ORDER.indexOf(col.status);

          return (
            <div
              key={col.status}
              className="flex flex-col min-w-[260px] flex-1"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>
                  {col.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-control text-text-quaternary tabular-nums">
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {colTasks.map((task) => (
                  <GlassCard key={task.id} className="!p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => setEditTask(task)}
                        className="text-left flex-1 min-w-0"
                      >
                        <p className="text-sm font-medium text-text-primary truncate">
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(task.id)}
                        className="text-text-quaternary hover:text-danger transition-colors shrink-0 mt-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Priority + labels */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {task.priority && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                      )}
                      {task.labels?.map((label) => (
                        <span
                          key={label}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/70"
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    {/* Move arrows */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
                      <span className="text-[10px] text-text-quaternary">
                        {new Date(task.updatedAt).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1">
                        {colIdx > 0 && (
                          <button
                            onClick={() => handleMove(task.id, STATUS_ORDER[colIdx - 1])}
                            disabled={actionLoading === task.id}
                            className="p-1 rounded text-text-quaternary hover:text-text-primary hover:bg-surface-control transition-colors"
                            title={`Move to ${COLUMNS[colIdx - 1].label}`}
                          >
                            {actionLoading === task.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <ChevronLeft size={12} />
                            )}
                          </button>
                        )}
                        {colIdx < STATUS_ORDER.length - 1 && (
                          <button
                            onClick={() => handleMove(task.id, STATUS_ORDER[colIdx + 1])}
                            disabled={actionLoading === task.id}
                            className="p-1 rounded text-text-quaternary hover:text-text-primary hover:bg-surface-control transition-colors"
                            title={`Move to ${COLUMNS[colIdx + 1].label}`}
                          >
                            {actionLoading === task.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <ChevronRight size={12} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Task Modal */}
      {showNew && (
        <TaskFormModal
          title="New Task"
          onClose={() => setShowNew(false)}
          onSubmit={(t) => handleCreate(t)}
        />
      )}

      {/* Edit Task Modal */}
      {editTask && (
        <TaskFormModal
          title="Edit Task"
          initial={editTask}
          onClose={() => setEditTask(null)}
          onSubmit={(t) => handleUpdate({ id: editTask.id, ...t })}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Task"
        message="Delete this task? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageShell>
  );
}

const INPUT =
  "bg-surface-input text-sm text-text-primary rounded-lg px-3 py-2 outline-none border border-border-subtle focus:border-accent transition-colors w-full";
const LABEL = "text-xs text-text-tertiary font-medium";

function TaskFormModal({
  title: modalTitle,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: TaskItem;
  onClose: () => void;
  onSubmit: (task: {
    title: string;
    description?: string;
    status: TaskStatus;
    priority?: Priority;
    labels?: string[];
  }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "queue");
  const [priority, setPriority] = useState<Priority | "">(initial?.priority ?? "");
  const [labelsText, setLabelsText] = useState(
    initial?.labels?.join(", ") ?? "",
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const labels = labelsText
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority: priority || undefined,
      labels: labels.length > 0 ? labels : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-window w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-separator">
          <h2 className="text-sm font-semibold text-text-primary">
            {modalTitle}
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
            <span className={LABEL}>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className={INPUT}
              required
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className={`${INPUT} resize-none`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={INPUT}
              >
                {COLUMNS.map((col) => (
                  <option key={col.status} value={col.status}>
                    {col.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority | "")}
                className={INPUT}
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Labels (comma separated)</span>
            <input
              type="text"
              value={labelsText}
              onChange={(e) => setLabelsText(e.target.value)}
              placeholder="bug, feature, docs"
              className={INPUT}
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
              disabled={!title.trim()}
              className="text-sm text-white bg-accent px-4 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
              {initial ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
