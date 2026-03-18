import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

// ── Frame types ──────────────────────────────────────────────

interface ReqFrame {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface ResFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: { code: string; message: string };
}

interface EventFrame {
  type: "event";
  event: string;
  payload: Record<string, unknown>;
}

type Frame = ReqFrame | ResFrame | EventFrame;

// ── Chat event payload ───────────────────────────────────────

export interface ChatEvent {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "error" | "aborted";
  message?: {
    role: string;
    content: { type: string; text: string }[];
    usage?: { input: number; output: number; totalTokens: number };
  };
  errorMessage?: string;
}

// ── Pending request / run tracking ───────────────────────────

interface PendingReq {
  resolve: (payload: Record<string, unknown>) => void;
  reject: (err: Error) => void;
}

interface RunListener {
  onDelta: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (msg: string) => void;
  cleanup: () => void;
}

// ── Gateway WebSocket client ─────────────────────────────────

export class GatewayWS extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private connected = false;
  private pendingReqs = new Map<string, PendingReq>();
  private runListeners = new Map<string, RunListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, token: string) {
    super();
    this.url = url;
    this.token = token;
  }

  // Connect to the gateway and perform handshake
  async connect(): Promise<void> {
    if (this.connected) return;
    return new Promise((resolve, reject) => {
      // Set origin to MC's own address (must be in gateway.controlUi.allowedOrigins)
      const ws = new WebSocket(this.url, {
        origin: "http://127.0.0.1:3333",
      });
      this.ws = ws;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Gateway WS connection timeout"));
      }, 10_000);

      ws.on("open", () => {
        // Send connect handshake
        const connectReq: ReqFrame = {
          type: "req",
          id: randomUUID(),
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "webchat-ui",
              version: "mc-0.1",
              platform: "linux",
              mode: "webchat",
              instanceId: randomUUID(),
            },
            caps: [],
            auth: { token: this.token, password: this.token },
            role: "operator",
            scopes: ["operator.admin"],
          },
        };

        this.pendingReqs.set(connectReq.id, {
          resolve: () => {
            clearTimeout(timeout);
            this.connected = true;
            this.emit("status", { connected: true });
            console.log("[gateway-ws] Connected and authenticated");
            resolve();
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        });

        ws.send(JSON.stringify(connectReq));
      });

      ws.on("message", (raw) => {
        this.handleMessage(raw.toString());
      });

      ws.on("close", () => {
        this.connected = false;
        this.emit("status", { connected: false });
        this.ws = null;
        // Reject all pending requests
        for (const [, req] of this.pendingReqs) {
          req.reject(new Error("WebSocket closed"));
        }
        this.pendingReqs.clear();
        // Notify all run listeners (deduplicate — same listener may be under multiple keys)
        const notified = new Set<RunListener>();
        for (const [, listener] of this.runListeners) {
          if (notified.has(listener)) continue;
          notified.add(listener);
          listener.onError("WebSocket closed");
        }
        this.runListeners.clear();
        this.scheduleReconnect();
      });

      ws.on("error", (err) => {
        console.error("[gateway-ws] Error:", err.message);
        clearTimeout(timeout);
        if (!this.connected) reject(err);
      });
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (err) {
        console.error(
          "[gateway-ws] Reconnect failed:",
          (err as Error).message,
        );
        this.scheduleReconnect();
      }
    }, 5_000);
  }

  private handleMessage(raw: string) {
    let frame: Frame;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    if (frame.type === "res") {
      const pending = this.pendingReqs.get(frame.id);
      if (pending) {
        this.pendingReqs.delete(frame.id);
        if (frame.ok) {
          pending.resolve(frame.payload ?? {});
        } else {
          pending.reject(
            new Error(frame.error?.message ?? "Unknown gateway error"),
          );
        }
      }
    } else if (frame.type === "event" && frame.event === "chat") {
      this.handleChatEvent(frame.payload as unknown as ChatEvent);
    }
    // Ignore other events (presence, tick, etc.)
  }

  private handleChatEvent(event: ChatEvent) {
    // Look up by runId first, fall back to sessionKey (gateway may assign its own runId)
    const listener =
      this.runListeners.get(event.runId) ??
      this.runListeners.get(event.sessionKey);
    if (!listener) return;

    const text = event.message?.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("") ?? "";

    switch (event.state) {
      case "delta":
        listener.onDelta(text);
        break;
      case "final":
        listener.onFinal(text);
        listener.cleanup();
        break;
      case "error":
        listener.onError(event.errorMessage ?? "Unknown error");
        listener.cleanup();
        break;
      case "aborted":
        listener.onError("Aborted");
        listener.cleanup();
        break;
    }
  }

  // Send a request and wait for the response
  sendReq(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error("Not connected to gateway"));
        return;
      }
      const id = randomUUID();
      const frame: ReqFrame = { type: "req", id, method, params };

      const timeout = setTimeout(() => {
        this.pendingReqs.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 30_000);

      this.pendingReqs.set(id, {
        resolve: (payload) => {
          clearTimeout(timeout);
          resolve(payload);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      this.ws.send(JSON.stringify(frame));
    });
  }

  // Send a chat message and get a stream of events via callbacks
  async chatSend(
    sessionKey: string,
    message: string,
    onDelta: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (msg: string) => void,
  ): Promise<string> {
    const idempotencyKey = randomUUID();

    const listener: RunListener = {
      onDelta,
      onFinal,
      onError,
      cleanup: () => {
        this.runListeners.delete(idempotencyKey);
        this.runListeners.delete(sessionKey);
      },
    };

    // Register by both idempotencyKey and sessionKey BEFORE sending
    // (events may arrive fast, and gateway may use its own runId)
    this.runListeners.set(idempotencyKey, listener);
    this.runListeners.set(sessionKey, listener);

    try {
      await this.sendReq("chat.send", {
        sessionKey,
        message,
        idempotencyKey,
      });
    } catch (err) {
      this.runListeners.delete(idempotencyKey);
      this.runListeners.delete(sessionKey);
      throw err;
    }

    return idempotencyKey;
  }

  // Get chat history for a session
  async chatHistory(
    sessionKey: string,
    limit = 200,
  ): Promise<{ role: string; content: string }[]> {
    const result = await this.sendReq("chat.history", { sessionKey, limit });
    const messages = (result.messages as { role: string; content: { type: string; text: string }[] }[]) ?? [];
    return messages.map((m) => ({
      role: m.role,
      content: m.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("") ?? "",
    }));
  }

  // Abort a running chat
  async chatAbort(sessionKey: string): Promise<void> {
    await this.sendReq("chat.abort", { sessionKey });
  }

  // List available tools/skills from the gateway
  async listTools(): Promise<{ name: string; description?: string; type?: string }[]> {
    try {
      const result = await this.sendReq("tools.list", {});
      const tools = (result.tools ?? result.items ?? []) as
        { name: string; description?: string; type?: string }[];
      return tools;
    } catch {
      // Fallback: try skills.list
      try {
        const result = await this.sendReq("skills.list", {});
        const skills = (result.skills ?? result.items ?? []) as
          { name: string; description?: string; type?: string }[];
        return skills;
      } catch {
        return [];
      }
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
  }
}
