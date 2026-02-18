import WebSocket from "ws";
import { randomUUID } from "node:crypto";

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

export class GatewayWS {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private connected = false;
  private pendingReqs = new Map<string, PendingReq>();
  private runListeners = new Map<string, RunListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  // Connect to the gateway and perform handshake
  async connect(): Promise<void> {
    if (this.connected) return;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
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
            auth: { token: this.token },
            role: "operator",
            scopes: ["operator.admin"],
          },
        };

        this.pendingReqs.set(connectReq.id, {
          resolve: () => {
            clearTimeout(timeout);
            this.connected = true;
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
        this.ws = null;
        // Reject all pending requests
        for (const [, req] of this.pendingReqs) {
          req.reject(new Error("WebSocket closed"));
        }
        this.pendingReqs.clear();
        // Notify all run listeners
        for (const [, listener] of this.runListeners) {
          listener.onError("WebSocket closed");
          listener.cleanup();
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
    const listener = this.runListeners.get(event.runId);
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
  private sendReq(
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
    const runId = randomUUID();

    // Register listener BEFORE sending (events may arrive fast)
    this.runListeners.set(runId, {
      onDelta,
      onFinal,
      onError,
      cleanup: () => this.runListeners.delete(runId),
    });

    try {
      await this.sendReq("chat.send", {
        sessionKey,
        message,
        idempotencyKey: runId,
      });
    } catch (err) {
      this.runListeners.delete(runId);
      throw err;
    }

    return runId;
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
