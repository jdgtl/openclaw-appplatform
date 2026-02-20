import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import type { GatewayWS } from "./gateway-ws.js";

// ── Browser → Server frames ─────────────────────────────────

interface ChatSendFrame {
  type: "chat.send";
  id: string;
  sessionKey: string;
  message: string;
}

interface ChatAbortFrame {
  type: "chat.abort";
  sessionKey: string;
}

interface PingFrame {
  type: "ping";
}

type InFrame = ChatSendFrame | ChatAbortFrame | PingFrame;

// ── Per-client state ─────────────────────────────────────────

interface ActiveChat {
  sessionKey: string;
  abort: () => void;
}

interface BrowserClient {
  ws: WebSocket;
  activeChats: Map<string, ActiveChat>; // id → chat
}

// ── Attach browser WS server to HTTP server ──────────────────

export function attachBrowserWS(
  server: http.Server,
  gatewayWs: GatewayWS,
): void {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<BrowserClient>();

  // Push gateway status changes to all connected browsers
  gatewayWs.on("status", (status: { connected: boolean }) => {
    const frame = JSON.stringify({
      type: "gateway.status",
      connected: status.connected,
    });
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(frame);
      }
    }
  });

  // Keepalive: ping every 30s, terminate if no pong within 10s
  const keepalive = setInterval(() => {
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      client.ws.ping();
    }
  }, 30_000);

  wss.on("close", () => clearInterval(keepalive));

  wss.on("connection", (ws) => {
    const client: BrowserClient = { ws, activeChats: new Map() };
    clients.add(client);

    // Send current gateway status immediately
    ws.send(
      JSON.stringify({
        type: "gateway.status",
        connected: gatewayWs.isConnected,
      }),
    );

    ws.on("message", (raw) => {
      let frame: InFrame;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (frame.type) {
        case "chat.send":
          handleChatSend(client, gatewayWs, frame);
          break;
        case "chat.abort":
          handleChatAbort(client, gatewayWs, frame);
          break;
        case "ping":
          send(ws, { type: "pong" });
          break;
      }
    });

    ws.on("close", () => {
      // Abort all active chats for this client
      for (const [, chat] of client.activeChats) {
        chat.abort();
      }
      client.activeChats.clear();
      clients.delete(client);
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────

function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function handleChatSend(
  client: BrowserClient,
  gatewayWs: GatewayWS,
  frame: ChatSendFrame,
): void {
  const { id, sessionKey, message } = frame;

  if (!id || !sessionKey || !message) {
    send(client.ws, {
      type: "chat.error",
      id,
      sessionKey,
      error: "Missing required fields: id, sessionKey, message",
    });
    return;
  }

  if (!gatewayWs.isConnected) {
    send(client.ws, {
      type: "chat.error",
      id,
      sessionKey,
      error: "Gateway not connected",
    });
    return;
  }

  let finished = false;
  const cleanup = () => {
    finished = true;
    client.activeChats.delete(id);
  };

  // Track this chat so we can abort on disconnect
  client.activeChats.set(id, {
    sessionKey,
    abort: () => {
      if (!finished) {
        cleanup();
        gatewayWs.chatAbort(sessionKey).catch(() => {});
      }
    },
  });

  gatewayWs
    .chatSend(
      sessionKey,
      message,
      // onDelta
      (text) => {
        if (finished) return;
        send(client.ws, { type: "chat.delta", id, sessionKey, text });
      },
      // onFinal
      (text) => {
        cleanup();
        send(client.ws, { type: "chat.final", id, sessionKey, text });
      },
      // onError
      (msg) => {
        cleanup();
        send(client.ws, { type: "chat.error", id, sessionKey, error: msg });
      },
    )
    .catch((err) => {
      cleanup();
      send(client.ws, {
        type: "chat.error",
        id,
        sessionKey,
        error: (err as Error).message,
      });
    });
}

function handleChatAbort(
  client: BrowserClient,
  gatewayWs: GatewayWS,
  frame: ChatAbortFrame,
): void {
  const { sessionKey } = frame;

  // Abort all active chats for this session key
  for (const [id, chat] of client.activeChats) {
    if (chat.sessionKey === sessionKey) {
      chat.abort();
      client.activeChats.delete(id);
    }
  }

  gatewayWs.chatAbort(sessionKey).catch(() => {});
}
