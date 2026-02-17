import { Router } from "express";
import { readFile } from "node:fs/promises";
import type { GatewayClient } from "../gateway.js";

export function sessionsRouter(gateway: GatewayClient): Router {
  const router = Router();

  // List all sessions
  router.get("/", async (_req, res) => {
    try {
      const result = await gateway.invokeTool("sessions_list");
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to list sessions",
      });
    }
  });

  // Get session history
  router.get("/:key/history", async (req, res) => {
    try {
      const sessions = (await gateway.invokeTool("sessions_list")) as {
        sessions?: { key: string; transcriptPath?: string }[];
      };

      const session = sessions?.sessions?.find(
        (s) => s.key === req.params.key,
      );

      if (!session?.transcriptPath) {
        res.status(404).json({ error: "Session or transcript not found" });
        return;
      }

      const raw = await readFile(session.transcriptPath, "utf-8");
      const lines = raw
        .trim()
        .split("\n")
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      res.json({ messages: lines });
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error ? err.message : "Failed to get session history",
      });
    }
  });

  // Send message to existing session
  router.post("/:key/send", async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message string is required" });
      return;
    }

    try {
      const result = await gateway.invokeTool("sessions_send", {
        sessionKey: req.params.key,
        message,
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to send message",
      });
    }
  });

  return router;
}
