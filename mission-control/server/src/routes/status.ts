import { Router } from "express";
import type { GatewayClient } from "../gateway.js";
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
    const [name, config, heartbeat, activity, sessions, health] =
      await Promise.allSettled([
        readIdentityName(),
        readConfig(),
        readHeartbeat(),
        readRecentActivity(3),
        gateway.invokeTool("sessions_list"),
        gateway.getStatus(),
      ]);

    const configVal =
      config.status === "fulfilled" ? config.value : null;

    const data = {
      agent: {
        name:
          name.status === "fulfilled" ? name.value : "Unknown",
        status: health.status === "fulfilled" ? "active" : "error",
        version:
          health.status === "fulfilled"
            ? (health.value as { version: string }).version
            : null,
      },
      sessions:
        sessions.status === "fulfilled" ? sessions.value : null,
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
