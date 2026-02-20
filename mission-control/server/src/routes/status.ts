import { Router } from "express";
import type { GatewayClient } from "../gateway.js";
import { unwrapToolResult } from "../lib/unwrap.js";
import {
  readConfig,
  readIdentityName,
  readHeartbeat,
  readRecentActivity,
} from "../filesystem.js";

interface CachedStatus {
  data: unknown;
  timestamp: number;
}

const CACHE_TTL = 30_000; // 30 seconds
let cache: CachedStatus | null = null;

export function statusRouter(gateway: GatewayClient): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const now = Date.now();

    // Return cached if fresh
    if (cache && now - cache.timestamp < CACHE_TTL) {
      res.json(cache.data);
      return;
    }

    // Fetch all data concurrently, tolerate individual failures
    // Note: skip gateway.getStatus() — /health hangs (WebSocket-only gateway)
    const [name, config, heartbeat, activity, sessionsResult] =
      await Promise.allSettled([
        readIdentityName(),
        readConfig(),
        readHeartbeat(),
        readRecentActivity(3),
        gateway.invokeTool("sessions_list"),
      ]);

    const configVal =
      config.status === "fulfilled" ? config.value : null;

    // Unwrap sessions from tool invoke result:
    // Raw: { ok: true, result: { details: { count, sessions } } }
    const sessionsRaw =
      sessionsResult.status === "fulfilled" ? sessionsResult.value : null;
    const sessionsData = unwrapToolResult(sessionsRaw);

    // Derive agent status from whether the gateway responded to tool calls
    const gatewayAlive = sessionsResult.status === "fulfilled";

    // Extract agent name from config or IDENTITY.md
    const agentName =
      (name.status === "fulfilled" && name.value) ||
      extractAgentName(configVal) ||
      null;

    const data = {
      agent: {
        name: agentName,
        status: gatewayAlive ? "active" : "error",
        version: null,
      },
      sessions: sessionsData,
      heartbeat:
        heartbeat.status === "fulfilled" ? heartbeat.value : null,
      channels: configVal
        ? extractChannels(configVal)
        : null,
      models: configVal
        ? extractModels(configVal)
        : null,
      activity:
        activity.status === "fulfilled" ? activity.value : [],
      timestamp: now,
    };

    cache = { data, timestamp: now };
    res.json(data);
  });

  return router;
}

function extractAgentName(config: Record<string, unknown> | null): string | null {
  if (!config) return null;
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  return (defaults?.name as string) ?? null;
}

function extractChannels(
  config: Record<string, unknown>,
): Record<string, { enabled: boolean }> {
  const channels: Record<string, { enabled: boolean }> = {};
  const ch = config.channels as Record<string, unknown> | undefined;
  if (!ch) return channels;

  for (const [name, value] of Object.entries(ch)) {
    if (value && typeof value === "object") {
      channels[name] = {
        enabled: (value as Record<string, unknown>).enabled !== false,
      };
    }
  }
  return channels;
}

function extractModels(
  config: Record<string, unknown>,
): unknown {
  const models = config.models ?? config.providers;
  return models ?? null;
}
