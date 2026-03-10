import { Router } from "express";
import { execFile } from "node:child_process";
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

  // Restart the OpenClaw gateway by killing the process tree (s6 auto-restarts it).
  // Cannot use `sudo s6-svc` — DO App Platform sets "no new privileges" flag.
  // Both MC and gateway run as `openclaw` user, so pkill works directly.
  //
  // The gateway runs as: runuser → bash -l -c "... && openclaw gateway ..."  → node
  // We kill the entire process group rooted at the runuser process so s6 detects
  // the service exit and restarts it cleanly.
  router.post("/restart", async (_req, res) => {
    try {
      // First, find the PID of the runuser process that launched the gateway.
      // Its cmdline contains "openclaw gateway" since that's the inline script.
      const pids = await new Promise<string>((resolve, reject) => {
        execFile(
          "pgrep",
          ["-u", "openclaw", "-f", "openclaw gateway"],
          { timeout: 5_000 },
          (error, stdout, stderr) => {
            if (error && error.code === 1) resolve(""); // no match
            else if (error) reject(new Error(stderr || error.message));
            else resolve(stdout.trim());
          },
        );
      });

      if (!pids) {
        res.json({ ok: true, message: "No gateway process found (may already be restarting)" });
        return;
      }

      // Kill all matched PIDs and their children with SIGTERM
      const pidList = pids.split("\n").filter(Boolean);
      await new Promise<void>((resolve, reject) => {
        execFile(
          "kill",
          ["--", ...pidList],
          { timeout: 5_000 },
          (error, _stdout, stderr) => {
            // ESRCH (no such process) is fine — it may have already exited
            if (error && !stderr.includes("No such process")) {
              reject(new Error(stderr || error.message));
            } else {
              resolve();
            }
          },
        );
      });

      res.json({ ok: true, message: `Gateway restart initiated (killed PIDs: ${pidList.join(", ")})` });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to restart gateway",
      });
    }
  });

  return router;
}
