import { Router } from "express";
import { readHeartbeat } from "../filesystem.js";
import type { GatewayClient } from "../gateway.js";

export function systemRouter(gateway: GatewayClient): Router {
  const router = Router();

  // System info
  router.get("/info", (_req, res) => {
    res.json({
      nodeVersion: process.version,
      uptime: process.uptime(),
      mcVersion: "0.1.0",
      pid: process.pid,
      memory: process.memoryUsage(),
    });
  });

  // Heartbeat state
  router.get("/heartbeat", async (_req, res) => {
    const heartbeat = await readHeartbeat();
    if (!heartbeat) {
      res.status(404).json({ error: "No heartbeat data" });
      return;
    }
    res.json(heartbeat);
  });

  // Trigger heartbeat / wake
  router.post("/heartbeat", async (_req, res) => {
    try {
      const result = await gateway.invokeTool("cron", { action: "wake" });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to wake agent",
      });
    }
  });

  return router;
}
