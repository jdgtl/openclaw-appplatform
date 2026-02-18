import { Router } from "express";
import { readFile } from "node:fs/promises";
import type { GatewayClient } from "../gateway.js";

// Unwrap the nested tool invoke response to get the actual data
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

export function sessionsRouter(gateway: GatewayClient): Router {
  const router = Router();

  // List all sessions
  router.get("/", async (_req, res) => {
    try {
      const raw = await gateway.invokeTool("sessions_list");
      res.json(unwrapToolResult(raw));
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to list sessions",
      });
    }
  });

  // Get session history
  router.get("/:key/history", async (req, res) => {
    try {
      const raw = await gateway.invokeTool("sessions_list");
      const sessions = unwrapToolResult(raw) as {
        sessions?: { key: string; transcriptPath?: string }[];
      };

      const session = sessions?.sessions?.find(
        (s) => s.key === req.params.key,
      );

      if (!session?.transcriptPath) {
        res.status(404).json({ error: "Session or transcript not found" });
        return;
      }

      const transcript = await readFile(session.transcriptPath, "utf-8");
      const lines = transcript
        .trim()
        .split("\n")
        .map((line: string) => {
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
