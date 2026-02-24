import { Router } from "express";
import type { GatewayClient } from "../gateway.js";
import { readConfig, writeConfig } from "../filesystem.js";

export function configRouter(gateway: GatewayClient): Router {
  const router = Router();

  // Read full config
  router.get("/", async (_req, res) => {
    try {
      const config = await readConfig();
      if (!config) {
        res.status(404).json({ error: "Config not found" });
        return;
      }
      res.json(config);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read config",
      });
    }
  });

  // Write config + reload
  router.put("/", async (req, res) => {
    const { config } = req.body;
    if (!config || typeof config !== "object") {
      res.status(400).json({ error: "config object is required" });
      return;
    }

    try {
      await writeConfig(config);
      const reloadError = await gateway.reloadConfig()
        .then(() => null)
        .catch((e: Error) => e.message);
      res.json({ ok: true, reloadError });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to write config",
      });
    }
  });

  // Read heartbeat section (stored at agents.defaults.heartbeat)
  router.get("/heartbeat", async (_req, res) => {
    try {
      const config = await readConfig();
      const agents = config?.agents as Record<string, unknown> | undefined;
      const defaults = agents?.defaults as Record<string, unknown> | undefined;
      const hb = defaults?.heartbeat as Record<string, unknown> | undefined;

      // Translate gateway format (every: "30m") to UI format (enabled, intervalMinutes)
      const every = hb?.every as string | undefined;
      const enabled = !!every && every !== "0m" && every !== "0";
      const mins = every ? parseInt(every) || 30 : 30;
      res.json({ enabled, intervalMinutes: mins });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read heartbeat config",
      });
    }
  });

  // Update heartbeat section (stored at agents.defaults.heartbeat)
  router.put("/heartbeat", async (req, res) => {
    const { heartbeat } = req.body;
    if (!heartbeat || typeof heartbeat !== "object") {
      res.status(400).json({ error: "heartbeat object is required" });
      return;
    }

    try {
      const config = (await readConfig()) ?? {};

      // Remove legacy root-level heartbeat key (causes config validation error)
      delete config.heartbeat;

      // Ensure agents.defaults path exists
      if (!config.agents || typeof config.agents !== "object") config.agents = {};
      const agents = config.agents as Record<string, unknown>;
      if (!agents.defaults || typeof agents.defaults !== "object") agents.defaults = {};
      const defaults = agents.defaults as Record<string, unknown>;

      // Write in gateway format: { every: "30m" }
      const mins = heartbeat.intervalMinutes ?? heartbeat.interval ?? 30;
      defaults.heartbeat = {
        every: heartbeat.enabled ? `${mins}m` : "0m",
      };

      await writeConfig(config);
      const reloadError = await gateway.reloadConfig()
        .then(() => null)
        .catch((e: Error) => e.message);
      res.json({ ok: true, reloadError });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to update heartbeat config",
      });
    }
  });

  return router;
}
