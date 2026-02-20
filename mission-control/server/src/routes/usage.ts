import { Router } from "express";
import { aggregateUsage } from "../filesystem.js";

interface CachedUsage {
  data: unknown;
  timestamp: number;
  days: number;
}

const CACHE_TTL = 60_000; // 60 seconds
let cache: CachedUsage | null = null;

export function usageRouter(): Router {
  const router = Router();

  router.get("/summary", async (req, res) => {
    const days = Math.min(Math.max(parseInt(String(req.query.days)) || 7, 1), 90);
    const now = Date.now();

    if (cache && cache.days === days && now - cache.timestamp < CACHE_TTL) {
      res.json(cache.data);
      return;
    }

    try {
      const data = await aggregateUsage(days);
      cache = { data, timestamp: now, days };
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to aggregate usage",
      });
    }
  });

  return router;
}
