import { Router } from "express";
import type { GatewayClient } from "../gateway.js";
import { unwrapToolResult } from "../lib/unwrap.js";
import { readConfig } from "../filesystem.js";

// Normalize a gateway cron job into a flat shape for the frontend
interface NormalizedJob {
  id: string;
  name: string;
  description?: string;
  agentId?: string;
  schedule: string;
  scheduleKind?: string;
  enabled: boolean;
  nextRun?: string;
  lastRun?: string;
  message?: string;
  sessionTarget?: string;
  wakeMode?: string;
  delivery?: string;
  timeout?: number;
  channel?: string;
  to?: string;
}

function normalizeJob(raw: Record<string, unknown>): NormalizedJob {
  const schedule = raw.schedule as Record<string, unknown> | string | undefined;
  let scheduleStr: string;
  let scheduleKind: string | undefined;

  if (typeof schedule === "string") {
    scheduleStr = schedule;
  } else if (schedule?.kind === "every") {
    scheduleStr = `Every ${schedule.value} ${schedule.unit}`;
    scheduleKind = "every";
  } else if (typeof schedule === "object" && schedule?.expr) {
    scheduleStr = schedule.expr as string;
    scheduleKind = "cron";
  } else {
    scheduleStr = "unknown";
  }

  const state = raw.state as Record<string, number> | undefined;
  const payload = raw.payload as Record<string, unknown> | undefined;
  const deliveryObj = raw.delivery as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    name: (raw.name as string) || (raw.id as string),
    description: raw.description as string | undefined,
    agentId: raw.agentId as string | undefined,
    schedule: scheduleStr,
    scheduleKind,
    enabled: raw.enabled !== false,
    nextRun: state?.nextRunAtMs
      ? new Date(state.nextRunAtMs).toISOString()
      : undefined,
    lastRun: state?.lastRunAtMs
      ? new Date(state.lastRunAtMs).toISOString()
      : undefined,
    message: payload?.message as string | undefined,
    sessionTarget: raw.sessionTarget as string | undefined,
    wakeMode: raw.wakeMode as string | undefined,
    delivery: deliveryObj?.mode as string | undefined,
    timeout: deliveryObj?.timeout as number | undefined,
    channel: deliveryObj?.channel as string | undefined,
    to: deliveryObj?.to as string | undefined,
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

  // Dynamic options for the "New Job" form
  router.get("/options", async (_req, res) => {
    try {
      const [config, sessionsRaw] = await Promise.allSettled([
        readConfig(),
        gateway.invokeTool("sessions_list"),
      ]);

      const cfg =
        config.status === "fulfilled" ? config.value : null;

      // Agent IDs from config
      const agents: string[] = ["default"];
      if (cfg?.agents && typeof cfg.agents === "object") {
        for (const key of Object.keys(cfg.agents as Record<string, unknown>)) {
          if (key !== "defaults" && !agents.includes(key)) agents.push(key);
        }
      }

      // Channel names from config
      const channels: string[] = ["last"];
      if (cfg?.channels && typeof cfg.channels === "object") {
        for (const key of Object.keys(cfg.channels as Record<string, unknown>)) {
          if (!channels.includes(key)) channels.push(key);
        }
      }

      // Active session keys
      const sessions: string[] = [];
      const sessData = sessionsRaw.status === "fulfilled"
        ? unwrapToolResult(sessionsRaw.value) as { sessions?: { key: string }[] }
        : null;
      if (sessData?.sessions) {
        for (const s of sessData.sessions) {
          if (s.key) sessions.push(s.key);
        }
      }

      // Models grouped by provider
      const models: { id: string; name: string; provider: string }[] = [];
      const providers = (cfg?.models as Record<string, unknown>)?.providers as
        Record<string, { models?: { id: string; name: string }[] }> | undefined;
      if (providers) {
        for (const [provider, p] of Object.entries(providers)) {
          for (const m of p.models ?? []) {
            models.push({ id: `${provider}/${m.id}`, name: m.name, provider });
          }
        }
      }

      res.json({ agents, channels, sessions, models });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to fetch options",
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

    // Build gateway job from frontend payload
    const gatewayJob: Record<string, unknown> = {
      name: job.name,
      enabled: job.enabled ?? true,
      sessionTarget: job.sessionTarget ?? "isolated",
    };

    if (job.description) gatewayJob.description = job.description;
    if (job.agentId) gatewayJob.agentId = job.agentId;
    if (job.wakeMode) gatewayJob.wakeMode = job.wakeMode;
    if (job.model) gatewayJob.model = job.model;

    // Schedule: accept string, {kind:"cron",expr}, or {kind:"every",value,unit}
    if (typeof job.schedule === "string") {
      gatewayJob.schedule = { kind: "cron", expr: job.schedule };
    } else {
      gatewayJob.schedule = job.schedule;
    }

    // Payload
    const payloadKind = job.payloadKind ?? "agentTurn";
    if (payloadKind === "agentTurn" && job.message) {
      gatewayJob.payload = { kind: "agentTurn", message: job.message };
    } else if (payloadKind === "wake") {
      gatewayJob.payload = { kind: "wake" };
    }

    // Delivery options
    if (job.delivery || job.timeout || job.channel || job.to) {
      const delivery: Record<string, unknown> = {};
      if (job.delivery) delivery.mode = job.delivery;
      if (job.timeout) delivery.timeout = Number(job.timeout);
      if (job.channel) delivery.channel = job.channel;
      if (job.to) delivery.to = job.to;
      gatewayJob.delivery = delivery;
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
