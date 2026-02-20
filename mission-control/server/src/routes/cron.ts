import { Router } from "express";
import type { GatewayClient } from "../gateway.js";

// Gateway returns { ok, result: { details: ..., content: [...] } }
// Unwrap to get the actual data
function unwrapToolResult(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const result = obj.result as Record<string, unknown> | undefined;
  if (result?.details) return result.details;
  if (result?.content && Array.isArray(result.content)) {
    const text = (result.content[0] as Record<string, string>)?.text;
    if (text) {
      try { return JSON.parse(text); } catch { /* ignore */ }
    }
  }
  return raw;
}

// Normalize a gateway cron job into a flat shape for the frontend
interface NormalizedJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  nextRun?: string;
  lastRun?: string;
  message?: string;
  sessionTarget?: string;
}

function normalizeJob(raw: Record<string, unknown>): NormalizedJob {
  const schedule = raw.schedule as Record<string, string> | string | undefined;
  const scheduleStr =
    typeof schedule === "string"
      ? schedule
      : schedule?.expr ?? "unknown";

  const state = raw.state as Record<string, number> | undefined;
  const payload = raw.payload as Record<string, string> | undefined;

  return {
    id: raw.id as string,
    name: (raw.name as string) || (raw.id as string),
    schedule: scheduleStr,
    enabled: raw.enabled !== false,
    nextRun: state?.nextRunAtMs
      ? new Date(state.nextRunAtMs).toISOString()
      : undefined,
    lastRun: state?.lastRunAtMs
      ? new Date(state.lastRunAtMs).toISOString()
      : undefined,
    message: payload?.message,
    sessionTarget: raw.sessionTarget as string | undefined,
  };
}

export function cronRouter(gateway: GatewayClient): Router {
  const router = Router();

  // List all cron jobs
  router.get("/", async (_req, res) => {
    try {
      const raw = await gateway.invokeTool("cron", { action: "list" });
      const data = unwrapToolResult(raw) as { jobs?: Record<string, unknown>[] };
      const jobs = (data?.jobs ?? []).map(normalizeJob);
      res.json({ jobs });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to list cron jobs",
      });
    }
  });

  // Create a cron job
  router.post("/", async (req, res) => {
    const { job } = req.body;
    if (!job) {
      res.status(400).json({ error: "job object is required" });
      return;
    }

    // Normalize: frontend sends flat format, gateway expects structured
    const gatewayJob: Record<string, unknown> = {
      name: job.name,
      enabled: job.enabled ?? true,
      sessionTarget: job.sessionTarget ?? "isolated",
      schedule:
        typeof job.schedule === "string"
          ? { kind: "cron", expr: job.schedule }
          : job.schedule,
    };

    if (job.message) {
      gatewayJob.payload = { kind: "agentTurn", message: job.message };
    }

    try {
      const raw = await gateway.invokeTool("cron", {
        action: "add",
        job: gatewayJob,
      });
      const data = unwrapToolResult(raw) as Record<string, unknown>;
      res.json(normalizeJob(data));
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to create cron job",
      });
    }
  });

  // Toggle a cron job
  router.post("/:id/toggle", async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled boolean is required" });
      return;
    }

    try {
      const result = await gateway.invokeTool("cron", {
        action: "update",
        jobId: req.params.id,
        patch: { enabled },
      });
      res.json(unwrapToolResult(result));
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to toggle cron job",
      });
    }
  });

  // Run a cron job immediately
  router.post("/:id/run", async (req, res) => {
    try {
      const result = await gateway.invokeTool("cron", {
        action: "run",
        jobId: req.params.id,
      });
      res.json(unwrapToolResult(result));
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to run cron job",
      });
    }
  });

  // Delete a cron job
  router.delete("/:id", async (req, res) => {
    try {
      const result = await gateway.invokeTool("cron", {
        action: "remove",
        jobId: req.params.id,
      });
      res.json(unwrapToolResult(result));
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to delete cron job",
      });
    }
  });

  return router;
}
