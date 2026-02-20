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

  // Read heartbeat section
  router.get("/heartbeat", async (_req, res) => {
    try {
      const config = await readConfig();
      const heartbeat = (config?.heartbeat ?? {}) as Record<string, unknown>;
      res.json(heartbeat);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read heartbeat config",
      });
    }
  });

  // Update heartbeat section
  router.put("/heartbeat", async (req, res) => {
    const { heartbeat } = req.body;
    if (!heartbeat || typeof heartbeat !== "object") {
      res.status(400).json({ error: "heartbeat object is required" });
      return;
    }

    try {
      const config = (await readConfig()) ?? {};
      config.heartbeat = heartbeat;
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
