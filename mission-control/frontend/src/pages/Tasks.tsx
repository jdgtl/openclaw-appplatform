import { useState, useCallback, useEffect } from "react";
import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { PriorityBadge } from "../components/PriorityBadge.js";
import { Modal, FormLabel, FormInput, FormTextarea, FormSelect, ModalActions } from "../components/Modal.js";
import { usePolling } from "../lib/hooks.js";
import { postJSON, putJSON, deleteJSON } from "../lib/api.js";
import {
  KanbanSquare,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
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
  { status: "queue", label: "Queue", color: "text-text-dim" },
  { status: "in_progress", label: "In Progress", color: "text-accent" },
  { status: "needs_human", label: "Needs Human", color: "text-warning" },
  { status: "completed", label: "Completed", color: "text-success" },
];

export function Tasks() {
  const { data, loading } = usePolling<TasksData>("/tasks", 15_000);
  const tasks = data?.tasks ?? [];
  const [showNew, setShowNew] = useState(false);
  const [editTask, setEditTask] = useState<TaskItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [hoverTask, setHoverTask] = useState<string | null>(null);

  // Drag state for queue column
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

  const handleDrop = useCallback(async (colTasks: TaskItem[]) => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const items = [...colTasks];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(dragOverIdx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    // Send reorder to server
    try {
      await putJSON("/tasks/reorder", { ids: items.map((t) => t.id) });
    } catch {
      // ignore
    }
  }, [dragIdx, dragOverIdx]);

  if (loading && !data) {
    return (
      <PageShell title="Tasks">
        <div className="flex items-center justify-center h-64 text-text-dim">
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
            <span className="text-sm text-text-muted">
              <strong className="text-text">{tasks.length}</strong> total
            </span>
          </div>
          {COLUMNS.map((col) => {
            const count = tasks.filter((t) => t.status === col.status).length;
            if (count === 0) return null;
            return (
              <div key={col.status} className="flex items-center gap-2">
                <span className={`text-sm ${col.color}`}>
                  <strong className="text-text">{count}</strong>{" "}
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
          const isDraggableCol = col.status === "queue";

          return (
            <div key={col.status} className="flex flex-col min-w-[260px] flex-1">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>
                  {col.label}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover text-text-faint tabular-nums">
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {colTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    draggable={isDraggableCol}
                    onDragStart={isDraggableCol ? () => setDragIdx(idx) : undefined}
                    onDragOver={isDraggableCol ? (e) => { e.preventDefault(); setDragOverIdx(idx); } : undefined}
                    onDrop={isDraggableCol ? () => handleDrop(colTasks) : undefined}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    onMouseEnter={() => setHoverTask(task.id)}
                    onMouseLeave={() => setHoverTask(null)}
                    className={`bg-card-bg border rounded-xl p-3 transition-all duration-200 relative ${
                      dragIdx === idx && isDraggableCol ? "opacity-40" : ""
                    } ${
                      dragOverIdx === idx && isDraggableCol && dragIdx !== null
                        ? "border-t-2 border-t-accent border-border"
                        : "border-border"
                    } hover:-translate-y-px`}
                  >
                    {/* Drag handle + edit */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        {isDraggableCol && (
                          <GripVertical size={14} className="text-text-faint mt-0.5 shrink-0 cursor-grab opacity-40" />
                        )}
                        <button
                          onClick={() => setEditTask(task)}
                          className="text-left flex-1 min-w-0"
                        >
                          <p className="text-sm font-medium text-text truncate">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-text-dim mt-0.5 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {hoverTask === task.id && (
                          <>
                            <button
                              onClick={() => setEditTask(task)}
                              className="p-1 rounded text-text-faint hover:text-accent transition-colors"
                              style={{ animation: "fadeIn 0.15s ease" }}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(task.id)}
                              className="p-1 rounded text-text-faint hover:text-danger transition-colors"
                              style={{ animation: "fadeIn 0.15s ease" }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Priority + labels */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {task.priority && <PriorityBadge priority={task.priority} />}
                      {task.labels?.map((label) => (
                        <span
                          key={label}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/70"
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    {/* Date */}
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="text-[10px] text-text-faint">
                        {new Date(task.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Task Modal */}
      <TaskFormModal
        open={showNew}
        title="New Task"
        onClose={() => setShowNew(false)}
        onSubmit={(t) => handleCreate(t)}
      />

      {/* Edit Task Modal */}
      <TaskFormModal
        open={!!editTask}
        title="Edit Task"
        initial={editTask ?? undefined}
        onClose={() => setEditTask(null)}
        onSubmit={(t) => editTask && handleUpdate({ id: editTask.id, ...t })}
      />

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

function TaskFormModal({
  open,
  title: modalTitle,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
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
  const [labelsText, setLabelsText] = useState(initial?.labels?.join(", ") ?? "");

  // Reset form when initial changes (different task or open/close)
  useEffect(() => {
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setStatus(initial?.status ?? "queue");
    setPriority(initial?.priority ?? "");
    setLabelsText(initial?.labels?.join(", ") ?? "");
  }, [initial?.id, open]);

  const handleSubmit = () => {
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
    <Modal open={open} onClose={onClose} title={modalTitle} maxWidth="max-w-md">
      <div className="p-6 flex flex-col gap-4">
        <div>
          <FormLabel>Title</FormLabel>
          <FormInput
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            placeholder="Task title"
            required
            autoFocus
          />
        </div>
        <div>
          <FormLabel>Description</FormLabel>
          <FormTextarea
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            placeholder="Optional description"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FormLabel>Status</FormLabel>
            <FormSelect
              value={status}
              onChange={(e) => setStatus(e.currentTarget.value as TaskStatus)}
            >
              {COLUMNS.map((col) => (
                <option key={col.status} value={col.status}>
                  {col.label}
                </option>
              ))}
            </FormSelect>
          </div>
          <div>
            <FormLabel>Priority</FormLabel>
            <FormSelect
              value={priority}
              onChange={(e) => setPriority(e.currentTarget.value as Priority | "")}
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </FormSelect>
          </div>
        </div>
        <div>
          <FormLabel>Labels (comma separated)</FormLabel>
          <FormInput
            value={labelsText}
            onChange={(e) => setLabelsText(e.currentTarget.value)}
            placeholder="bug, feature, docs"
          />
        </div>
      </div>
      <ModalActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={initial ? "Update" : "Create"}
        disabled={!title.trim()}
      />
    </Modal>
  );
}
