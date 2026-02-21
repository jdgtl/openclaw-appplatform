import { readFile, writeFile, readdir, stat, rename, mkdir, rm } from "node:fs/promises";
import { join, basename } from "node:path";
import { randomBytes } from "node:crypto";
import { modelCost } from "./lib/pricing.js";

const stateDir = process.env.OPENCLAW_STATE_DIR || "/data/.openclaw";

// OpenClaw's workspace lives at ~/.openclaw/workspace which symlinks to /data/.openclaw/workspace
const workspaceDir =
  process.env.OPENCLAW_WORKSPACE_DIR || "/data/.openclaw/workspace";

export async function readConfig(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(join(stateDir, "openclaw.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readIdentityName(): Promise<string | null> {
  try {
    const raw = await readFile(join(workspaceDir, "IDENTITY.md"), "utf-8");
    const match = raw.match(/\*\*Name:\*\*\s*(.+)/);
    if (match?.[1]) return match[1].trim();
  } catch {
    // not found
  }
  return null;
}

export async function readHeartbeat(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(
      join(workspaceDir, "memory", "heartbeat-state.json"),
      "utf-8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readRecentActivity(
  days: number = 3,
): Promise<{ file: string; content: string }[]> {
  const memoryDir = join(workspaceDir, "memory");
  try {
    const files = await readdir(memoryDir);
    const mdFiles = files
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, days);
    if (mdFiles.length === 0) return [];
    const results: { file: string; content: string }[] = [];
    for (const file of mdFiles) {
      try {
        const content = await readFile(join(memoryDir, file), "utf-8");
        results.push({ file, content: content.slice(0, 2000) });
      } catch { /* skip */ }
    }
    return results;
  } catch {
    return [];
  }
}

// ── Config write ──

export async function writeConfig(config: Record<string, unknown>): Promise<void> {
  const configPath = join(stateDir, "openclaw.json");
  const tmp = configPath + "." + randomBytes(4).toString("hex") + ".tmp";
  await writeFile(tmp, JSON.stringify(config, null, 2) + "\n", "utf-8");
  await rename(tmp, configPath);
}

// ── Workspace file operations ──

function sanitizeFileName(name: string): string {
  const safe = basename(name).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe === "." || safe === "..") {
    throw new Error("Invalid filename");
  }
  return safe;
}

export async function listWorkspaceFiles(): Promise<
  { name: string; size: number; modified: string }[]
> {
  try {
    const files = await readdir(workspaceDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const results: { name: string; size: number; modified: string }[] = [];
    for (const name of mdFiles) {
      try {
        const s = await stat(join(workspaceDir, name));
        results.push({ name, size: s.size, modified: s.mtime.toISOString() });
      } catch { /* skip */ }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function readWorkspaceFile(name: string): Promise<string | null> {
  try {
    const safe = sanitizeFileName(name);
    if (!safe.endsWith(".md")) return null;
    return await readFile(join(workspaceDir, safe), "utf-8");
  } catch {
    return null;
  }
}

export async function writeWorkspaceFile(name: string, content: string): Promise<void> {
  const safe = sanitizeFileName(name);
  if (!safe.endsWith(".md")) throw new Error("Only .md files can be written");
  await writeFile(join(workspaceDir, safe), content, "utf-8");
}

export async function listMemoryFiles(): Promise<
  { name: string; size: number; modified: string }[]
> {
  const memoryDir = join(workspaceDir, "memory");
  try {
    const files = await readdir(memoryDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const results: { name: string; size: number; modified: string }[] = [];
    for (const name of mdFiles) {
      try {
        const s = await stat(join(memoryDir, name));
        results.push({ name, size: s.size, modified: s.mtime.toISOString() });
      } catch { /* skip */ }
    }
    return results.sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

export async function readMemoryFile(name: string): Promise<string | null> {
  try {
    const safe = sanitizeFileName(name);
    if (!safe.endsWith(".md")) return null;
    return await readFile(join(workspaceDir, "memory", safe), "utf-8");
  } catch {
    return null;
  }
}

// ── Skills operations ──

const skillsDir = join(stateDir, "skills");

function sanitizeDirName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safe) {
    throw new Error("Invalid directory name");
  }
  return safe;
}

export async function listSkills(): Promise<
  { name: string; description: string; modified: string }[]
> {
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const results: { name: string; description: string; modified: string }[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(skillsDir, entry.name, "SKILL.md");
      try {
        const content = await readFile(skillFile, "utf-8");
        const s = await stat(skillFile);
        const descMatch = content.match(/^description:\s*["']?(.+?)["']?\s*$/m);
        results.push({
          name: entry.name,
          description: descMatch?.[1] ?? "",
          modified: s.mtime.toISOString(),
        });
      } catch { /* skip skills without SKILL.md */ }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function readSkill(name: string): Promise<string | null> {
  try {
    const safe = sanitizeDirName(name);
    return await readFile(join(skillsDir, safe, "SKILL.md"), "utf-8");
  } catch {
    return null;
  }
}

export async function writeSkill(name: string, content: string): Promise<void> {
  const safe = sanitizeDirName(name);
  const dir = join(skillsDir, safe);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), content, "utf-8");
}

export async function deleteSkill(name: string): Promise<void> {
  const safe = sanitizeDirName(name);
  await rm(join(skillsDir, safe), { recursive: true, force: true });
}

// ── Usage / transcript aggregation ──

interface UsageSummary {
  byModel: Record<string, { messages: number; input: number; output: number }>;
  byDay: Record<string, { input: number; output: number; messages: number }>;
  totalInput: number;
  totalOutput: number;
  totalTokens: number;
  messageCount: number;
  costByModel: Record<string, number>;
  totalCost: number;
}

export async function aggregateUsage(days: number = 7): Promise<UsageSummary> {
  const sessionsDir = join(stateDir, "agents", "main", "sessions");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result: UsageSummary = {
    byModel: {},
    byDay: {},
    totalInput: 0,
    totalOutput: 0,
    totalTokens: 0,
    messageCount: 0,
    costByModel: {},
    totalCost: 0,
  };

  try {
    const files = await readdir(sessionsDir);
    const jsonlFiles = files
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse()
      .slice(0, 50);

    for (const file of jsonlFiles) {
      try {
        const content = await readFile(join(sessionsDir, file), "utf-8");
        for (const line of content.split("\n")) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            if (entry?.type !== "message" || !entry?.message) continue;

            const msg = entry.message;
            const usage = msg.usage ?? entry.usage;
            if (!usage) continue;

            const input = usage.input_tokens ?? usage.inputTokens ?? usage.input ?? 0;
            const output = usage.output_tokens ?? usage.outputTokens ?? usage.output ?? 0;
            const model = msg.model ?? entry.model ?? "unknown";

            // Extract date from timestamp or file name
            let day: string;
            if (entry.timestamp) {
              const d = new Date(entry.timestamp);
              if (d < cutoff) continue;
              day = d.toISOString().slice(0, 10);
            } else {
              // Try to extract date from filename (sessionId-topic-timestamp.jsonl)
              const tsMatch = file.match(/(\d{13})/);
              if (tsMatch) {
                const d = new Date(parseInt(tsMatch[1]));
                if (d < cutoff) continue;
                day = d.toISOString().slice(0, 10);
              } else {
                day = new Date().toISOString().slice(0, 10);
              }
            }

            result.totalInput += input;
            result.totalOutput += output;
            result.totalTokens += input + output;
            result.messageCount++;

            if (!result.byModel[model]) {
              result.byModel[model] = { messages: 0, input: 0, output: 0 };
            }
            result.byModel[model].messages++;
            result.byModel[model].input += input;
            result.byModel[model].output += output;

            if (!result.byDay[day]) {
              result.byDay[day] = { input: 0, output: 0, messages: 0 };
            }
            result.byDay[day].input += input;
            result.byDay[day].output += output;
            result.byDay[day].messages++;

            // Prefer pre-calculated cost from transcript, fall back to our estimate
            const preCalcCost = typeof usage.cost?.total === "number" ? usage.cost.total : null;
            const cost = preCalcCost ?? modelCost(model, input, output);
            result.totalCost += cost;
            result.costByModel[model] = (result.costByModel[model] ?? 0) + cost;
          } catch { /* skip bad lines */ }
        }
      } catch { /* skip unreadable files */ }
    }
  } catch { /* sessions dir not found */ }

  return result;
}

// ── Tasks persistence ──

const tasksPath = join(workspaceDir, "tasks.json");

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "planning" | "in_progress" | "review" | "complete";
  priority?: "low" | "medium" | "high";
  labels?: string[];
  prUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface TasksFile {
  version: number;
  tasks: TaskItem[];
}

export async function readTasks(): Promise<TasksFile> {
  try {
    const raw = await readFile(tasksPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { version: 1, tasks: [] };
  }
}

export async function writeTasks(data: TasksFile): Promise<void> {
  await writeFile(tasksPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ── Cron categories (local-only, not stored in gateway) ──

const cronCategoriesPath = join(workspaceDir, "cron-categories.json");

export async function readCronCategories(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(cronCategoriesPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function writeCronCategories(data: Record<string, string>): Promise<void> {
  await writeFile(cronCategoriesPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ── OpenClaw version detection ──

let cachedOpenClawVersion: string | null = null;

export async function detectOpenClawVersion(): Promise<string> {
  if (cachedOpenClawVersion) return cachedOpenClawVersion;

  // Try reading from pnpm global install
  const candidates = [
    join(stateDir, "version"),
    "/home/openclaw/.openclaw/version",
  ];

  for (const p of candidates) {
    try {
      const v = (await readFile(p, "utf-8")).trim();
      if (v) { cachedOpenClawVersion = v; return v; }
    } catch { /* continue */ }
  }

  // Try execing the binary
  try {
    const { execSync } = await import("node:child_process");
    const out = execSync("openclaw --version 2>/dev/null || openclaw version 2>/dev/null", {
      timeout: 3000,
      encoding: "utf-8",
    }).trim();
    // Extract version number from output (e.g. "openclaw 2026.2.14" -> "2026.2.14")
    const match = out.match(/(\d{4}\.\d+\.\d+)/);
    if (match) { cachedOpenClawVersion = match[1]; return match[1]; }
    if (out) { cachedOpenClawVersion = out; return out; }
  } catch { /* binary not available or timed out */ }

  cachedOpenClawVersion = "unknown";
  return "unknown";
}
