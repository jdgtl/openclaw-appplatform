// Mock gateway for local development without a real OpenClaw instance.
// Start with: MOCK=true npm run dev

import type { GatewayClient, Message, ChatResponse } from "./gateway.js";

interface MockJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: unknown;
  payload?: unknown;
  delivery?: unknown;
  agentId?: string;
  sessionTarget?: string;
  wakeMode?: string;
  model?: string;
  state: { nextRunAtMs: number; lastRunAtMs: number | null; runCount: number };
}

let jobCounter = 0;
const jobs = new Map<string, MockJob>();

// Seed a couple of example jobs
function seed() {
  const now = Date.now();
  const j1: MockJob = {
    id: "cron_mock_1",
    name: "Heartbeat check",
    description: "Periodic health ping",
    enabled: true,
    schedule: { kind: "every", value: 15, unit: "minutes" },
    payload: { kind: "wake" },
    agentId: "default",
    sessionTarget: "isolated",
    wakeMode: "now",
    state: { nextRunAtMs: now + 900_000, lastRunAtMs: now - 600_000, runCount: 42 },
  };
  const j2: MockJob = {
    id: "cron_mock_2",
    name: "Daily summary",
    description: "Write a summary of activity",
    enabled: false,
    schedule: { kind: "cron", expr: "0 9 * * *" },
    payload: { kind: "agentTurn", message: "Write a daily summary" },
    agentId: "default",
    sessionTarget: "new",
    wakeMode: "now",
    state: { nextRunAtMs: now + 3_600_000 * 12, lastRunAtMs: null, runCount: 0 },
  };
  jobs.set(j1.id, j1);
  jobs.set(j2.id, j2);
}
seed();

function wrap(details: unknown) {
  return { ok: true, result: { details } };
}

function handleCron(args: Record<string, unknown>): unknown {
  const action = args.action as string;

  switch (action) {
    case "list":
      return wrap({ jobs: [...jobs.values()] });

    case "add": {
      const id = `cron_mock_${++jobCounter + 2}`;
      const now = Date.now();
      const job: MockJob = {
        id,
        name: (args.name as string) || "Unnamed",
        description: args.description as string | undefined,
        enabled: (args.enabled as boolean) ?? true,
        schedule: args.schedule,
        payload: args.payload,
        delivery: args.delivery,
        agentId: args.agentId as string | undefined,
        sessionTarget: args.sessionTarget as string | undefined,
        wakeMode: args.wakeMode as string | undefined,
        model: args.model as string | undefined,
        state: { nextRunAtMs: now + 3_600_000, lastRunAtMs: null, runCount: 0 },
      };
      jobs.set(id, job);
      console.log(`[mock] Cron job created: ${id} "${job.name}" — args received:`, JSON.stringify(args, null, 2));
      return wrap(job);
    }

    case "update": {
      const job = jobs.get(args.jobId as string);
      if (!job) throw new Error(`Job not found: ${args.jobId}`);
      const patch = args.patch as Record<string, unknown> | undefined;
      if (patch) {
        if (typeof patch.enabled === "boolean") job.enabled = patch.enabled;
      }
      return wrap(job);
    }

    case "run": {
      const job = jobs.get(args.jobId as string);
      if (!job) throw new Error(`Job not found: ${args.jobId}`);
      job.state.lastRunAtMs = Date.now();
      job.state.runCount++;
      return wrap(job);
    }

    case "remove": {
      const id = args.jobId as string;
      const job = jobs.get(id);
      if (!job) throw new Error(`Job not found: ${id}`);
      jobs.delete(id);
      return wrap({ removed: id });
    }

    case "wake":
      return wrap({ ok: true });

    default:
      throw new Error(`Unknown cron action: ${action}`);
  }
}

export class MockGatewayClient {
  async invokeTool(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
    console.log(`[mock] invokeTool("${tool}", ${JSON.stringify(args)})`);

    switch (tool) {
      case "cron":
        return handleCron(args);

      case "sessions_list":
        return wrap({ sessions: [] });

      default:
        console.warn(`[mock] Unhandled tool: ${tool}`);
        return wrap({});
    }
  }

  async chatStream(_messages: Message[]): Promise<Response> {
    throw new Error("Chat not available in mock mode");
  }

  async chatSync(_messages: Message[]): Promise<ChatResponse> {
    return { choices: [{ message: { content: "Mock response" } }] };
  }

  async reloadConfig(): Promise<void> {
    console.log("[mock] Config reload (no-op)");
  }

  async getStatus(): Promise<{ version: string }> {
    return { version: "mock-0.0.0" };
  }
}
