import { Router } from "express";
import type { GatewayWS } from "../gateway-ws.js";

const DEFAULT_SESSION_KEY = "mc:chat";

export function chatRouter(gatewayWs: GatewayWS): Router {
  const router = Router();

  // Stream a chat message to the agent via SSE
  router.post("/", (req, res) => {
    const { message, sessionKey } = req.body as {
      message?: string;
      sessionKey?: string;
    };

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message string is required" });
      return;
    }

    if (!gatewayWs.isConnected) {
      res.status(502).json({ error: "Gateway WebSocket not connected" });
      return;
    }

    const key = sessionKey || DEFAULT_SESSION_KEY;

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      res.write("data: [DONE]\n\n");
      res.end();
    };

    // Handle client disconnect
    req.on("close", () => {
      ended = true;
    });

    gatewayWs
      .chatSend(
        key,
        message,
        // onDelta — accumulated text so far
        (text) => {
          if (ended) return;
          const payload = {
            choices: [{ delta: { content: text }, index: 0 }],
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        },
        // onFinal — complete response
        (text) => {
          if (ended) return;
          const payload = {
            choices: [
              {
                delta: { content: text },
                index: 0,
                finish_reason: "stop",
              },
            ],
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
          finish();
        },
        // onError
        (msg) => {
          if (ended) return;
          res.write(
            `data: ${JSON.stringify({ error: { message: msg } })}\n\n`,
          );
          finish();
        },
      )
      .catch((err) => {
        if (ended) return;
        res.write(
          `data: ${JSON.stringify({ error: { message: (err as Error).message } })}\n\n`,
        );
        finish();
      });
  });

  // Get chat history for a session
  router.get("/history", async (req, res) => {
    const sessionKey = (req.query.sessionKey as string) || DEFAULT_SESSION_KEY;

    if (!gatewayWs.isConnected) {
      res.status(502).json({ error: "Gateway WebSocket not connected" });
      return;
    }

    try {
      const messages = await gatewayWs.chatHistory(sessionKey);
      res.json({ sessionKey, messages });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to get history",
      });
    }
  });

  return router;
}
