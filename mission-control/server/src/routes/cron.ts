import { Router } from "express";
import type { GatewayWS } from "../gateway-ws.js";
import { readConfig, readCronCategories, writeCronCategories } from "../filesystem.js";

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
  category?: string;
  runCount?: number;
}

function normalizeJob(raw: Record<string, unknown>): NormalizedJob {
  const schedule = raw.schedule as Record<string, unknown> | string | undefined;
  let scheduleStr: string;
  let scheduleKind: string | undefined;

  if (typeof schedule === "string") {
    scheduleStr = schedule;
  } else if (schedule?.kind === "every") {
    const ms = schedule.everyMs as number | undefined;
    if (ms) {
      if (ms >= 86_400_000) scheduleStr = `Every ${ms / 86_400_000}d`;
      else if (ms >= 3_600_000) scheduleStr = `Every ${ms / 3_600_000}h`;
      else scheduleStr = `Every ${ms / 60_000}m`;
    } else {
      scheduleStr = `Every ${schedule.value ?? "?"} ${schedule.unit ?? ""}`.trim();
    }
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
    category: raw.category as string | undefined,
    runCount: typeof state?.runCount === "number" ? state.runCount : undefined,
  };
}

export function cronRouter(gatewayWs: GatewayWS): Router {
  const router = Router();

  // List all cron jobs (merges local categories)
  router.get("/", async (_req, res) => {
    try {
      const [raw, categories] = await Promise.all([
        gatewayWs.sendReq("cron.list", {}),
        readCronCategories(),
      ]);
      const jobs = ((raw.jobs ?? []) as Record<string, unknown>[]).map((j) => {
        const job = normalizeJob(j);
        if (categories[job.id]) job.category = categories[job.id];
        return job;
      });
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
        gatewayWs.sendReq("sessions.list", {}),
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
        ? sessionsRaw.value as { sessions?: { key: string }[] }
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

    // Schedule: convert to gateway format
    if (typeof job.schedule === "string") {
      gatewayJob.schedule = { kind: "cron", expr: job.schedule };
    } else if (job.schedule?.kind === "every" && job.schedule.value && job.schedule.unit) {
      const multipliers: Record<string, number> = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
      const everyMs = Number(job.schedule.value) * (multipliers[job.schedule.unit] ?? 60_000);
      gatewayJob.schedule = { kind: "every", everyMs };
    } else {
      gatewayJob.schedule = job.schedule;
    }

    // Payload
    const payloadKind = job.payloadKind ?? "agentTurn";
    if (payloadKind === "agentTurn") {
      gatewayJob.payload = { kind: "agentTurn", message: job.message || "" };
    } else {
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
      const raw = await gatewayWs.sendReq("cron.add", gatewayJob);
      const normalized = normalizeJob(raw);

      // Save category locally (not a gateway concept)
      if (job.category && normalized.id) {
        const categories = await readCronCategories();
        categories[normalized.id] = job.category;
        normalized.category = job.category;
        await writeCronCategories(categories);
      }

      res.json(normalized);
    } catch (err) {
      console.error("[cron] Failed to create job:", err instanceof Error ? err.message : err);
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to create cron job",
      });
    }
  });

  // Update a job's category (local-only, not a gateway concept)
  router.put("/:id/category", async (req, res) => {
    const { category } = req.body;
    if (typeof category !== "string") {
      res.status(400).json({ error: "category string is required" });
      return;
    }
    try {
      const categories = await readCronCategories();
      if (category) {
        categories[req.params.id] = category;
      } else {
        delete categories[req.params.id];
      }
      await writeCronCategories(categories);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to update category",
      });
    }
  });

  // Update a cron job
  router.put("/:id", async (req, res) => {
    const { job } = req.body;
    if (!job) {
      res.status(400).json({ error: "job object is required" });
      return;
    }

    const patch: Record<string, unknown> = {};
    if (job.name !== undefined) patch.name = job.name;
    if (job.description !== undefined) patch.description = job.description;
    if (job.enabled !== undefined) patch.enabled = job.enabled;
    if (job.agentId !== undefined) patch.agentId = job.agentId;
    if (job.sessionTarget !== undefined) patch.sessionTarget = job.sessionTarget;
    if (job.wakeMode !== undefined) patch.wakeMode = job.wakeMode;
    if (job.model !== undefined) patch.model = job.model;

    // Schedule
    if (job.schedule) {
      if (typeof job.schedule === "string") {
        patch.schedule = { kind: "cron", expr: job.schedule };
      } else if (job.schedule.kind === "every" && job.schedule.value && job.schedule.unit) {
        const multipliers: Record<string, number> = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
        const everyMs = Number(job.schedule.value) * (multipliers[job.schedule.unit] ?? 60_000);
        patch.schedule = { kind: "every", everyMs };
      } else {
        patch.schedule = job.schedule;
      }
    }

    // Payload
    if (job.payloadKind !== undefined || job.message !== undefined) {
      const payloadKind = job.payloadKind ?? "agentTurn";
      if (payloadKind === "agentTurn") {
        patch.payload = { kind: "agentTurn", message: job.message || "" };
      } else {
        patch.payload = { kind: "wake" };
      }
    }

    // Delivery
    if (job.delivery || job.timeout || job.channel || job.to) {
      const delivery: Record<string, unknown> = {};
      if (job.delivery) delivery.mode = job.delivery;
      if (job.timeout) delivery.timeout = Number(job.timeout);
      if (job.channel) delivery.channel = job.channel;
      if (job.to) delivery.to = job.to;
      patch.delivery = delivery;
    }

    try {
      const raw = await gatewayWs.sendReq("cron.update", {
        jobId: req.params.id,
        patch,
      });
      const normalized = normalizeJob(raw);

      // Update local category if provided
      if (job.category !== undefined) {
        const categories = await readCronCategories();
        if (job.category) {
          categories[req.params.id] = job.category;
          normalized.category = job.category;
        } else {
          delete categories[req.params.id];
        }
        await writeCronCategories(categories);
      }

      res.json(normalized);
    } catch (err) {
      console.error("[cron] Failed to update job:", err instanceof Error ? err.message : err);
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to update cron job",
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
      const result = await gatewayWs.sendReq("cron.update", {
        jobId: req.params.id,
        patch: { enabled },
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to toggle cron job",
      });
    }
  });

  // Run a cron job immediately
  router.post("/:id/run", async (req, res) => {
    try {
      const result = await gatewayWs.sendReq("cron.run", {
        jobId: req.params.id,
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to run cron job",
      });
    }
  });

  // Delete a cron job
  router.delete("/:id", async (req, res) => {
    try {
      const result = await gatewayWs.sendReq("cron.remove", {
        jobId: req.params.id,
      });

      // Clean up local category mapping
      const categories = await readCronCategories();
      if (categories[req.params.id]) {
        delete categories[req.params.id];
        await writeCronCategories(categories);
      }

      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to delete cron job",
      });
    }
  });

  return router;
}
