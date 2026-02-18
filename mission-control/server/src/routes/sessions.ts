import { Router } from "express";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { GatewayClient } from "../gateway.js";

const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";

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

// Extract plain text from OpenClaw's content array format
// Content can be: string | [{type: "text", text: "..."}, {type: "thinking", ...}]
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: Record<string, string>) => c.type === "text")
      .map((c: Record<string, string>) => c.text)
      .join("");
  }
  return String(content ?? "");
}

// Find transcript file by session ID in the state dir
async function findTranscript(sessionId: string): Promise<string | null> {
  const sessionsDir = join(stateDir, "agents", "main", "sessions");
  try {
    const files = await readdir(sessionsDir);
    const match = files.find(
      (f) => f.startsWith(sessionId) && f.endsWith(".jsonl"),
    );
    return match ? join(sessionsDir, match) : null;
  } catch {
    return null;
  }
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
        sessions?: {
          key: string;
          sessionId?: string;
          transcriptPath?: string;
        }[];
      };

      const session = sessions?.sessions?.find(
        (s) => s.key === req.params.key,
      );

      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      // Find transcript: try reported path first, then search by session ID
      let resolvedPath: string | undefined = session.transcriptPath;
      if (resolvedPath) {
        try {
          await readFile(resolvedPath, "utf-8");
        } catch {
          resolvedPath = undefined;
        }
      }

      if (!resolvedPath && session.sessionId) {
        resolvedPath = (await findTranscript(session.sessionId)) ?? undefined;
      }

      const transcriptPath = resolvedPath;

      if (!transcriptPath) {
        res.json({ messages: [] });
        return;
      }

      const transcript = await readFile(transcriptPath, "utf-8");
      const messages = transcript
        .trim()
        .split("\n")
        .map((line: string) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(
          (entry: Record<string, unknown> | null) =>
            entry?.type === "message" &&
            (entry.message as Record<string, unknown>)?.role,
        )
        .map((entry: Record<string, unknown>) => {
          const msg = entry.message as Record<string, unknown>;
          return {
            role: msg.role as string,
            content: extractText(msg.content),
          };
        })
        .filter((m: { content: string }) => m.content.length > 0);

      res.json({ messages });
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
