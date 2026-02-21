import { Router } from "express";
import {
  listSkills,
  readSkill,
  writeSkill,
  deleteSkill,
  readConfig,
  aggregateSkillUsage,
  deriveCategory,
} from "../filesystem.js";

export function skillsRouter(): Router {
  const router = Router();

  // ── New endpoints (MUST be before /:name) ──

  // Skill usage aggregation
  router.get("/usage", async (req, res) => {
    const days = Math.min(Math.max(parseInt(String(req.query.days)) || 30, 1), 365);
    try {
      const data = await aggregateSkillUsage(days);
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to aggregate skill usage",
      });
    }
  });

  // Unified skill list (custom + built-in + usage)
  router.get("/all", async (req, res) => {
    const days = Math.min(Math.max(parseInt(String(req.query.days)) || 30, 1), 365);
    try {
      const [customSkills, config, usage] = await Promise.all([
        listSkills(),
        readConfig(),
        aggregateSkillUsage(days),
      ]);

      const skills: {
        name: string;
        description: string;
        source: "custom" | "built-in";
        category: string;
        modified: string | null;
        usageCount: number;
        lastUsed: string | null;
      }[] = [];

      // Add custom skills
      for (const s of customSkills) {
        const su = usage.bySkill[s.name];
        skills.push({
          name: s.name,
          description: s.description,
          source: "custom",
          category: deriveCategory(s.name, s.description),
          modified: s.modified,
          usageCount: su?.count ?? 0,
          lastUsed: su?.lastUsed ?? null,
        });
      }

      // Extract built-in commands/skills from config
      const customNames = new Set(customSkills.map((s) => s.name));
      if (config) {
        const commands = config.commands as Record<string, unknown> | undefined;
        if (commands && typeof commands === "object") {
          for (const [name, value] of Object.entries(commands)) {
            if (customNames.has(name)) continue;
            const desc = (value && typeof value === "object")
              ? ((value as Record<string, unknown>).description as string) ?? ""
              : "";
            const su = usage.bySkill[name];
            skills.push({
              name,
              description: desc,
              source: "built-in",
              category: deriveCategory(name, desc),
              modified: null,
              usageCount: su?.count ?? 0,
              lastUsed: su?.lastUsed ?? null,
            });
          }
        }
      }

      // Also surface any skills from usage that aren't in either list
      for (const [name, su] of Object.entries(usage.bySkill)) {
        if (skills.some((s) => s.name === name)) continue;
        skills.push({
          name,
          description: "",
          source: "built-in",
          category: deriveCategory(name, ""),
          modified: null,
          usageCount: su.count,
          lastUsed: su.lastUsed,
        });
      }

      res.json({ skills, usage });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Failed to list all skills",
      });
    }
  });

  // ── Existing CRUD endpoints ──

  // List custom skills
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
