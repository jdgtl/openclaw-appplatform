import { Router } from "express";
import type { GatewayClient } from "../gateway.js";

export function chatRouter(_gateway: GatewayClient): Router {
  const router = Router();

  // Chat via HTTP is not supported by the OpenClaw gateway in this version.
  // The gateway uses WebSocket for interactive chat. This endpoint will be
  // implemented once WebSocket proxying is added.
  router.post("/", (_req, res) => {
    res.status(501).json({
      error: "Chat is not yet available — the gateway uses WebSocket for interactive chat. Use Slack or the Sessions page to communicate with the agent.",
    });
  });

  return router;
}
