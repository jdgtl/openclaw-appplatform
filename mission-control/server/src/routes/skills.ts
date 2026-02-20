import { Router } from "express";
import {
  listSkills,
  readSkill,
  writeSkill,
  deleteSkill,
} from "../filesystem.js";

export function skillsRouter(): Router {
  const router = Router();

  // List all skills
  router.get("/", async (_req, res) => {
    try {
      const skills = await listSkills();
      res.json({ skills });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to list skills",
      });
    }
  });

  // Read skill
  router.get("/:name", async (req, res) => {
    try {
      const content = await readSkill(req.params.name);
      if (content === null) {
        res.status(404).json({ error: "Skill not found" });
        return;
      }
      res.json({ name: req.params.name, content });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to read skill",
      });
    }
  });

  // Update skill
  router.put("/:name", async (req, res) => {
    const { content } = req.body;
    if (typeof content !== "string") {
      res.status(400).json({ error: "content string is required" });
      return;
    }

    try {
      await writeSkill(req.params.name, content);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to write skill",
      });
    }
  });

  // Create new skill
  router.post("/", async (req, res) => {
    const { name, content } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name string is required" });
      return;
    }

    try {
      await writeSkill(name, content ?? defaultSkillTemplate(name));
      res.json({ ok: true, name });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to create skill",
      });
    }
  });

  // Delete skill
  router.delete("/:name", async (req, res) => {
    try {
      await deleteSkill(req.params.name);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to delete skill",
      });
    }
  });

  return router;
}

function defaultSkillTemplate(name: string): string {
  return `---
name: "${name}"
description: "Description of ${name}"
metadata:
  user_invocable: true
---

# ${name}

Describe what this skill does here.
`;
}
