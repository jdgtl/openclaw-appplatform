import { Router } from "express";
import type { GatewayClient } from "../gateway.js";

export function cronRouter(gateway: GatewayClient): Router {
  const router = Router();

  // List all cron jobs
  router.get("/", async (_req, res) => {
    try {
      const result = await gateway.invokeTool("cron", { action: "list" });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to list cron jobs",
      });
    }
  });

  // Create a cron job
  router.post("/", async (req, res) => {
    const { job } = req.body;
    if (!job) {
      res.status(400).json({ error: "job object is required" });
      return;
    }

    try {
      const result = await gateway.invokeTool("cron", {
        action: "add",
        job,
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to create cron job",
      });
    }
  });

  // Toggle a cron job
  router.post("/:id/toggle", async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled boolean is required" });
      return;
    }

    try {
      const result = await gateway.invokeTool("cron", {
        action: "update",
        jobId: req.params.id,
        patch: { enabled },
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to toggle cron job",
      });
    }
  });

  // Run a cron job immediately
  router.post("/:id/run", async (req, res) => {
    try {
      const result = await gateway.invokeTool("cron", {
        action: "run",
        jobId: req.params.id,
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to run cron job",
      });
    }
  });

  // Delete a cron job
  router.delete("/:id", async (req, res) => {
    try {
      const result = await gateway.invokeTool("cron", {
        action: "remove",
        jobId: req.params.id,
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Failed to delete cron job",
      });
    }
  });

  return router;
}
