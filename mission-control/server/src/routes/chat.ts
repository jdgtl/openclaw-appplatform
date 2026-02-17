import { Router } from "express";
import type { GatewayClient } from "../gateway.js";

export function chatRouter(gateway: GatewayClient): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    try {
      const upstream = await gateway.chatStream(messages);

      // Pipe SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch {
        // Client disconnected or upstream error
      } finally {
        res.end();
      }
    } catch (err) {
      if (!res.headersSent) {
        res.status(502).json({
          error: err instanceof Error ? err.message : "Gateway error",
        });
      }
    }
  });

  return router;
}
