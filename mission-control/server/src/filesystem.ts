import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const stateDir = process.env.OPENCLAW_STATE_DIR ?? "/data/.openclaw";
const workspaceDir = process.env.OPENCLAW_WORKSPACE_DIR ?? "/data/workspace";

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
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
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

    const results: { file: string; content: string }[] = [];
    for (const file of mdFiles) {
      try {
        const content = await readFile(join(memoryDir, file), "utf-8");
        results.push({ file, content: content.slice(0, 2000) });
      } catch {
        // skip unreadable files
      }
    }
    return results;
  } catch {
    return [];
  }
}
