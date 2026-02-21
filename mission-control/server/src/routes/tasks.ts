import { Router } from "express";
import { randomBytes } from "node:crypto";
import { readTasks, writeTasks, type TaskItem } from "../filesystem.js";
import { notifySlack } from "../lib/slack-notify.js";

const VALID_STATUSES = ["todo", "planning", "in_progress", "review", "complete"];
const VALID_PRIORITIES = ["low", "medium", "high"];

// Migrate old statuses from the 4-column layout
const STATUS_MIGRATION: Record<string, TaskItem["status"]> = {
  queue: "todo",
  needs_human: "review",
  completed: "complete",
};

function migrateStatus(status: string): TaskItem["status"] {
  return (STATUS_MIGRATION[status] ?? status) as TaskItem["status"];
}

function migrateTasks(tasks: TaskItem[]): TaskItem[] {
  for (const t of tasks) {
    const migrated = migrateStatus(t.status);
    if (migrated !== t.status) t.status = migrated;
  }
  return tasks;
}

export function tasksRouter(): Router {
  const router = Router();

  // List all tasks
  router.get("/", async (_req, res) => {
    try {
      const data = await readTasks();
      data.tasks = migrateTasks(data.tasks);
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read tasks",
      });
    }
  });

  // Create task
  router.post("/", async (req, res) => {
    const { title, description, status, priority, labels, prUrl } = req.body;
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title string is required" });
      return;
    }
    const resolvedStatus = status ? migrateStatus(status) : "todo";
    if (!VALID_STATUSES.includes(resolvedStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      res.status(400).json({ error: "Invalid priority" });
      return;
    }
    if (labels && (!Array.isArray(labels) || !labels.every((l: unknown) => typeof l === "string"))) {
      res.status(400).json({ error: "labels must be an array of strings" });
      return;
    }

    try {
      const data = await readTasks();
      data.tasks = migrateTasks(data.tasks);
      const now = new Date().toISOString();
      const task: TaskItem = {
        id: randomBytes(8).toString("hex"),
        title,
        description: description || undefined,
        status: resolvedStatus as TaskItem["status"],
        priority: priority || undefined,
        labels: labels || undefined,
        prUrl: prUrl || undefined,
        createdAt: now,
        updatedAt: now,
      };
      data.tasks.push(task);
      data.version++;
      await writeTasks(data);
      res.json(task);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to create task",
      });
    }
  });

  // Reorder tasks
  router.put("/reorder", async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.every((id: unknown) => typeof id === "string")) {
      res.status(400).json({ error: "ids must be an array of strings" });
      return;
    }

    try {
      const data = await readTasks();
      data.tasks = migrateTasks(data.tasks);
      const taskMap = new Map(data.tasks.map((t) => [t.id, t]));

      // Ordered tasks: those in the ids list, in the given order
      const ordered: TaskItem[] = [];
      for (const id of ids) {
        const task = taskMap.get(id);
        if (task) {
          ordered.push(task);
          taskMap.delete(id);
        }
      }

      // Remaining tasks not in the ids list go at the end
      const remaining = data.tasks.filter((t) => taskMap.has(t.id));
      data.tasks = [...ordered, ...remaining];
      data.version++;
      await writeTasks(data);
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to reorder tasks",
      });
    }
  });

  // Update task
  router.put("/:id", async (req, res) => {
    const { title, description, status, priority, labels, prUrl, expectedVersion } = req.body;

    const resolvedStatus = status !== undefined ? migrateStatus(status) : undefined;
    if (resolvedStatus !== undefined && !VALID_STATUSES.includes(resolvedStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    if (priority !== undefined && priority && !VALID_PRIORITIES.includes(priority)) {
      res.status(400).json({ error: "Invalid priority" });
      return;
    }

    try {
      const data = await readTasks();
      data.tasks = migrateTasks(data.tasks);

      if (expectedVersion != null && data.version !== expectedVersion) {
        res.status(409).json({ error: "Version conflict", currentVersion: data.version });
        return;
      }

      const task = data.tasks.find((t) => t.id === req.params.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      const previousStatus = task.status;

      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description || undefined;
      if (resolvedStatus !== undefined) task.status = resolvedStatus as TaskItem["status"];
      if (priority !== undefined) task.priority = priority || undefined;
      if (labels !== undefined) task.labels = labels;
      if (prUrl !== undefined) task.prUrl = prUrl || undefined;
      task.updatedAt = new Date().toISOString();

      data.version++;
      await writeTasks(data);
      res.json(task);

      // Fire Slack notification when transitioning to review
      if (previousStatus !== "review" && task.status === "review") {
        const prLine = task.prUrl ? `\nPR: ${task.prUrl}` : "";
        const desc = task.description ? `\n>${task.description.slice(0, 200)}` : "";
        notifySlack(`*Task ready for review:* ${task.title}${desc}${prLine}`);
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to update task",
      });
    }
  });

  // Move task (change status)
  router.put("/:id/move", async (req, res) => {
    const { status } = req.body;
    const resolvedStatus = status ? migrateStatus(status) : undefined;
    if (!resolvedStatus || !VALID_STATUSES.includes(resolvedStatus)) {
      res.status(400).json({ error: "Valid status is required" });
      return;
    }

    try {
      const data = await readTasks();
      data.tasks = migrateTasks(data.tasks);
      const task = data.tasks.find((t) => t.id === req.params.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      const previousStatus = task.status;
      task.status = resolvedStatus as TaskItem["status"];
      task.updatedAt = new Date().toISOString();
      data.version++;
      await writeTasks(data);
      res.json(task);

      // Fire Slack notification when transitioning to review
      if (previousStatus !== "review" && task.status === "review") {
        const prLine = task.prUrl ? `\nPR: ${task.prUrl}` : "";
        notifySlack(`*Task ready for review:* ${task.title}${prLine}`);
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to move task",
      });
    }
  });

  // Delete task
  router.delete("/:id", async (req, res) => {
    try {
      const data = await readTasks();
      const idx = data.tasks.findIndex((t) => t.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      data.tasks.splice(idx, 1);
      data.version++;
      await writeTasks(data);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to delete task",
      });
    }
  });

  return router;
}
