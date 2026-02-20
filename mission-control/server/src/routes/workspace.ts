import { Router } from "express";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  listMemoryFiles,
  readMemoryFile,
} from "../filesystem.js";

export function workspaceRouter(): Router {
  const router = Router();

  // List workspace .md files
  router.get("/files", async (_req, res) => {
    try {
      const files = await listWorkspaceFiles();
      res.json({ files });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to list workspace files",
      });
    }
  });

  // Read workspace file
  router.get("/files/:name", async (req, res) => {
    try {
      const content = await readWorkspaceFile(req.params.name);
      if (content === null) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      res.json({ name: req.params.name, content });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read file",
      });
    }
  });

  // Write workspace file
  router.put("/files/:name", async (req, res) => {
    const { content } = req.body;
    if (typeof content !== "string") {
      res.status(400).json({ error: "content string is required" });
      return;
    }

    try {
      await writeWorkspaceFile(req.params.name, content);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to write file",
      });
    }
  });

  // List memory dir files
  router.get("/memory", async (_req, res) => {
    try {
      const files = await listMemoryFiles();
      res.json({ files });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to list memory files",
      });
    }
  });

  // Read memory file (read-only)
  router.get("/memory/:name", async (req, res) => {
    try {
      const content = await readMemoryFile(req.params.name);
      if (content === null) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      res.json({ name: req.params.name, content });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read memory file",
      });
    }
  });

  return router;
}
