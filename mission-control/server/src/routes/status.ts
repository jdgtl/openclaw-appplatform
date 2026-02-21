import { Router } from "express";
import type { GatewayClient } from "../gateway.js";
import { unwrapToolResult } from "../lib/unwrap.js";
import {
  readConfig,
  readIdentityName,
  readHeartbeat,
  readRecentActivity,
  detectOpenClawVersion,
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
    const [name, config, heartbeat, activity, sessionsResult, openclawVersion] =
      await Promise.allSettled([
        readIdentityName(),
        readConfig(),
        readHeartbeat(),
        readRecentActivity(3),
        gateway.invokeTool("sessions_list"),
        detectOpenClawVersion(),
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

    const version =
      openclawVersion.status === "fulfilled" ? openclawVersion.value : null;

    const data = {
      agent: {
        name: agentName,
        status: gatewayAlive ? "active" : "error",
        version,
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
      providers: configVal
        ? extractProviders(configVal)
        : [],
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
): Record<string, { enabled: boolean; status: "active" | "paused" | "error" }> {
  const channels: Record<string, { enabled: boolean; status: "active" | "paused" | "error" }> = {};
  const ch = config.channels as Record<string, unknown> | undefined;
  if (!ch) return channels;

  for (const [name, value] of Object.entries(ch)) {
    if (value && typeof value === "object") {
      const enabled = (value as Record<string, unknown>).enabled !== false;
      channels[name] = {
        enabled,
        status: enabled ? "active" : "paused",
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

function extractProviders(
  config: Record<string, unknown>,
): { name: string; models: number; status: string }[] {
  const models = config.models as Record<string, unknown> | undefined;
  if (!models) return [];

  const providers = models.providers as Record<string, unknown> | undefined;
  if (!providers || typeof providers !== "object") return [];

  const result: { name: string; models: number; status: string }[] = [];
  for (const [name, value] of Object.entries(providers)) {
    if (value && typeof value === "object") {
      const providerConfig = value as Record<string, unknown>;
      // Count models: look for a "models" array or object within the provider config
      const providerModels = providerConfig.models;
      let modelCount = 0;
      if (Array.isArray(providerModels)) {
        modelCount = providerModels.length;
      } else if (providerModels && typeof providerModels === "object") {
        modelCount = Object.keys(providerModels).length;
      }
      result.push({ name, models: modelCount, status: "active" });
    }
  }
  return result;
}
