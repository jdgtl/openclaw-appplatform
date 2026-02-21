import { Router } from "express";
import { exec } from "node:child_process";
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

  // Restart the OpenClaw gateway (via s6 supervisor)
  router.post("/restart", async (_req, res) => {
    try {
      await new Promise<void>((resolve, reject) => {
        exec(
          "sudo /command/s6-svc -r /run/service/openclaw",
          { timeout: 10_000 },
          (error, _stdout, stderr) => {
            if (error) reject(new Error(stderr || error.message));
            else resolve();
          },
        );
      });
      res.json({ ok: true, message: "Gateway restart initiated" });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to restart gateway",
      });
    }
  });

  return router;
}
