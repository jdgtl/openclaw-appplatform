import { useState, useEffect, useRef, useCallback } from "react";
import { fetchJSON, postJSON } from "./api.js";

// Poll an API endpoint at a fixed interval
export function usePolling<T>(
  path: string,
  intervalMs: number = 30_000,
): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const result = await fetchJSON<T>(path);
        if (active) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [path, intervalMs]);

  return { data, error, loading };
}

// SSE-based chat with the agent
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useSSEChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const allMessages = [
      ...messages,
      { role: "user" as const, content: text },
    ];

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add placeholder for assistant response
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE data lines
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
            }
          } catch {
            // non-JSON SSE line, skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => [
          ...prev.filter((m) => m.content !== ""),
          {
            role: "assistant",
            content: `Error: ${(err as Error).message}`,
          },
        ]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages]);

  return { messages, streaming, send };
}

// Trigger a manual fetch
export function useMutation<TInput, TOutput>(
  path: string,
): {
  mutate: (body: TInput) => Promise<TOutput>;
  loading: boolean;
  error: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body: TInput): Promise<TOutput> => {
      setLoading(true);
      setError(null);
      try {
        const result = await postJSON<TOutput>(path, body);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  return { mutate, loading, error };
}
