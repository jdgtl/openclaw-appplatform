import { Router } from "express";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface CachedData {
  data: unknown;
  timestamp: number;
}

const CACHE_TTL = 60_000;
let cache: CachedData | null = null;

const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";
const AUTH_PROFILES_PATH = join(stateDir, "agents", "main", "agent", "auth-profiles.json");

async function readOAuthToken(): Promise<string | null> {
  try {
    const raw = await readFile(AUTH_PROFILES_PATH, "utf-8");
    const profiles = JSON.parse(raw);
    return profiles?.profiles?.["openai-codex:default"]?.access ?? null;
  } catch {
    return null;
  }
}

export function openaiUsageRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const now = Date.now();

    if (cache && now - cache.timestamp < CACHE_TTL) {
      res.json(cache.data);
      return;
    }

    const token = await readOAuthToken();
    if (!token) {
      const payload = { available: false, reason: "no_token" };
      res.json(payload);
      return;
    }

    try {
      const resp = await fetch("https://chatgpt.com/backend-api/wham/usage", {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "OpenClaw-MissionControl/1.0",
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        const payload = { available: false, reason: "token_expired" };
        res.json(payload);
        return;
      }

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        res.status(502).json({
          available: false,
          reason: "fetch_error",
          detail: `${resp.status}: ${body}`,
        });
        return;
      }

      const raw = await resp.json();
      const payload = { available: true, ...normalizeUsage(raw) };
      cache = { data: payload, timestamp: now };
      res.json(payload);
    } catch (err) {
      res.status(502).json({
        available: false,
        reason: "fetch_error",
        detail: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  return router;
}

function normalizeUsage(raw: Record<string, unknown>): Record<string, unknown> {
  // Pass through raw and also extract known fields into a stable shape.
  // The wham/usage response structure may vary — we extract what we can
  // and the frontend handles missing fields gracefully.
  const result: Record<string, unknown> = { raw };

  try {
    // Common shapes: { rate_limits: [...], credits: { remaining: N } }
    // or { usage_windows: [...], credits_snapshot: { balance: N } }
    const limits = (raw.rate_limits ?? raw.usage_windows ?? []) as Array<Record<string, unknown>>;
    const windows: Record<string, unknown>[] = [];

    for (const limit of limits) {
      const name = String(limit.name ?? limit.label ?? limit.type ?? "unknown");
      const remaining = Number(limit.remaining ?? limit.percent_remaining ?? 0);
      const total = Number(limit.total ?? limit.limit ?? 100);
      const resetAt = limit.reset_at ?? limit.resets_at ?? limit.reset ?? null;
      const percentRemaining =
        limit.percent_remaining != null
          ? Number(limit.percent_remaining)
          : total > 0
            ? (remaining / total) * 100
            : 0;

      windows.push({
        name,
        remaining,
        total,
        percentRemaining,
        percentUsed: 100 - percentRemaining,
        resetAt,
      });
    }

    result.windows = windows;

    // Credits
    const credits = raw.credits ?? raw.credits_snapshot;
    if (credits && typeof credits === "object") {
      const c = credits as Record<string, unknown>;
      result.credits = {
        remaining: c.remaining ?? c.balance ?? 0,
        hasCredits: c.hasCredits ?? c.has_credits ?? false,
        unlimited: c.unlimited ?? false,
      };
    }
  } catch {
    // normalization failed — raw is still available
  }

  return result;
}
