import { Router } from "express";
import { randomBytes } from "node:crypto";
import { readTasks, writeTasks, type TaskItem } from "../filesystem.js";

const VALID_STATUSES = ["queue", "in_progress", "needs_human", "completed"];
const VALID_PRIORITIES = ["low", "medium", "high"];

export function tasksRouter(): Router {
  const router = Router();

  // List all tasks
  router.get("/", async (_req, res) => {
    try {
      const data = await readTasks();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read tasks",
      });
    }
  });

  // Create task
  router.post("/", async (req, res) => {
    const { title, description, status, priority, labels } = req.body;
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title string is required" });
      return;
    }
    if (status && !VALID_STATUSES.includes(status)) {
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
      const now = new Date().toISOString();
      const task: TaskItem = {
        id: randomBytes(8).toString("hex"),
        title,
        description: description || undefined,
        status: status || "queue",
        priority: priority || undefined,
        labels: labels || undefined,
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
    const { title, description, status, priority, labels, expectedVersion } = req.body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    if (priority !== undefined && priority && !VALID_PRIORITIES.includes(priority)) {
      res.status(400).json({ error: "Invalid priority" });
      return;
    }

    try {
      const data = await readTasks();

      if (expectedVersion != null && data.version !== expectedVersion) {
        res.status(409).json({ error: "Version conflict", currentVersion: data.version });
        return;
      }

      const task = data.tasks.find((t) => t.id === req.params.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description || undefined;
      if (status !== undefined) task.status = status;
      if (priority !== undefined) task.priority = priority || undefined;
      if (labels !== undefined) task.labels = labels;
      task.updatedAt = new Date().toISOString();

      data.version++;
      await writeTasks(data);
      res.json(task);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to update task",
      });
    }
  });

  // Move task (change status)
  router.put("/:id/move", async (req, res) => {
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: "Valid status is required" });
      return;
    }

    try {
      const data = await readTasks();
      const task = data.tasks.find((t) => t.id === req.params.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      task.status = status;
      task.updatedAt = new Date().toISOString();
      data.version++;
      await writeTasks(data);
      res.json(task);
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
