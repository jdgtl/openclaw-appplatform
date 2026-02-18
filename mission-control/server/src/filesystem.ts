import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const stateDir = process.env.OPENCLAW_STATE_DIR ?? "/data/.openclaw";
const workspaceDir = process.env.OPENCLAW_WORKSPACE_DIR ?? "/data/workspace";
// The agent's actual home — where IDENTITY.md, memory/, transcripts live
const agentHome = process.env.OPENCLAW_AGENT_HOME ?? "/home/openclaw";

export async function readConfig(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(join(stateDir, "openclaw.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function readIdentityName(): Promise<string | null> {
  // Try agent home first (where OpenClaw actually runs), then workspace dir
  for (const dir of [agentHome, workspaceDir]) {
    try {
      const raw = await readFile(join(dir, "IDENTITY.md"), "utf-8");
      const match = raw.match(/\*\*Name:\*\*\s*(.+)/);
      if (match?.[1]) return match[1].trim();
    } catch {
      // try next
    }
  }
  return null;
}

export async function readHeartbeat(): Promise<Record<string, unknown> | null> {
  for (const dir of [agentHome, workspaceDir]) {
    try {
      const raw = await readFile(
        join(dir, "memory", "heartbeat-state.json"),
        "utf-8",
      );
      return JSON.parse(raw);
    } catch {
      // try next
    }
  }
  return null;
}

export async function readRecentActivity(
  days: number = 3,
): Promise<{ file: string; content: string }[]> {
  // Try agent home first, then workspace dir
  for (const dir of [agentHome, workspaceDir]) {
    const memoryDir = join(dir, "memory");
    try {
      const files = await readdir(memoryDir);
      const mdFiles = files
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, days);
      if (mdFiles.length === 0) continue;
      const results: { file: string; content: string }[] = [];
      for (const file of mdFiles) {
        try {
          const content = await readFile(join(memoryDir, file), "utf-8");
          results.push({ file, content: content.slice(0, 2000) });
        } catch { /* skip */ }
      }
      return results;
    } catch {
      // try next
    }
  }
  return [];
}
