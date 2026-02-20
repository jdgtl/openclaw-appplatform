type StatusListener = (connected: boolean) => void;

interface ChatCallbacks {
  onDelta: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: string) => void;
}

class McWebSocket {
  private ws: WebSocket | null = null;
  private statusListeners = new Set<StatusListener>();
  private chatListeners = new Map<string, ChatCallbacks>();
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _gatewayConnected = false;

  constructor() {
    this.connect();
  }

  private getUrl(): string {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}/ws`;
  }

  private connect(): void {
    try {
      const ws = new WebSocket(this.getUrl());
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectDelay = 1000;
      };

      ws.onmessage = (event) => {
        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(event.data as string);
        } catch {
          return;
        }
        this.handleFrame(frame);
      };

      ws.onclose = () => {
        this.ws = null;
        // Notify all active chats of error
        for (const [id, cb] of this.chatListeners) {
          cb.onError("Connection lost");
          this.chatListeners.delete(id);
        }
        // Gateway is unreachable when WS is down
        this.setGatewayConnected(false);
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    // Exponential backoff: 1s → 2s → 4s → ... → 30s max
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
  }

  private handleFrame(frame: Record<string, unknown>): void {
    switch (frame.type) {
      case "gateway.status":
        this.setGatewayConnected(frame.connected as boolean);
        break;
      case "chat.delta": {
        const cb = this.chatListeners.get(frame.id as string);
        cb?.onDelta(frame.text as string);
        break;
      }
      case "chat.final": {
        const cb = this.chatListeners.get(frame.id as string);
        if (cb) {
          cb.onFinal(frame.text as string);
          this.chatListeners.delete(frame.id as string);
        }
        break;
      }
      case "chat.error": {
        const cb = this.chatListeners.get(frame.id as string);
        if (cb) {
          cb.onError(frame.error as string);
          this.chatListeners.delete(frame.id as string);
        }
        break;
      }
      case "pong":
        break;
    }
  }

  private setGatewayConnected(connected: boolean): void {
    if (this._gatewayConnected === connected) return;
    this._gatewayConnected = connected;
    for (const listener of this.statusListeners) {
      listener(connected);
    }
  }

  get gatewayConnected(): boolean {
    return this._gatewayConnected;
  }

  chatSend(
    sessionKey: string,
    message: string,
    callbacks: ChatCallbacks,
  ): string {
    const id = crypto.randomUUID();
    this.chatListeners.set(id, callbacks);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Defer error to next tick so caller can handle it
      setTimeout(() => {
        callbacks.onError("Not connected");
        this.chatListeners.delete(id);
      }, 0);
      return id;
    }

    this.ws.send(
      JSON.stringify({ type: "chat.send", id, sessionKey, message }),
    );
    return id;
  }

  chatAbort(sessionKey: string): void {
    // Remove listeners for this session
    for (const [id, _cb] of this.chatListeners) {
      this.chatListeners.delete(id);
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "chat.abort", sessionKey }));
    }
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }
}

export const mcWs = new McWebSocket();
