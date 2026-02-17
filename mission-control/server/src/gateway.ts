export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  choices: { message: { content: string } }[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class GatewayClient {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  async invokeTool(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/tools/invoke`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ tool, args }),
    });
    if (!res.ok) {
      throw new Error(`Gateway tool invoke failed (${res.status}): ${await res.text()}`);
    }
    return res.json();
  }

  async chatStream(messages: Message[]): Promise<Response> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        messages,
        stream: true,
      }),
    });
    if (!res.ok) {
      throw new Error(`Gateway chat failed (${res.status}): ${await res.text()}`);
    }
    return res;
  }

  async chatSync(messages: Message[]): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        messages,
        stream: false,
      }),
    });
    if (!res.ok) {
      throw new Error(`Gateway chat failed (${res.status}): ${await res.text()}`);
    }
    return res.json() as Promise<ChatResponse>;
  }

  async reloadConfig(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/config/reload`, {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Gateway config reload failed (${res.status})`);
    }
  }

  async getStatus(): Promise<{ version: string }> {
    const res = await fetch(`${this.baseUrl}/health`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Gateway health check failed (${res.status})`);
    }
    return res.json() as Promise<{ version: string }>;
  }
}
