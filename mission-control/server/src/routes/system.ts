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

  // Restart the OpenClaw gateway by killing the process (s6 auto-restarts it).
  // Cannot use `sudo s6-svc` — DO App Platform sets "no new privileges" flag.
  // Both MC and gateway run as `openclaw` user, so pkill works directly.
  router.post("/restart", async (_req, res) => {
    try {
      await new Promise<void>((resolve, reject) => {
        exec(
          "pkill -u openclaw -f 'openclaw gateway'",
          { timeout: 5_000 },
          (error, _stdout, stderr) => {
            // pkill exit 1 = no process matched — treat as success
            if (error && error.code !== 1) reject(new Error(stderr || error.message));
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
