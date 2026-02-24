import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { fetchJSON, postJSON } from "./api.js";
import { mcWs } from "./ws-client.js";

// Poll an API endpoint at a fixed interval
export function usePolling<T>(
  path: string,
  intervalMs: number = 30_000,
): { data: T | null; error: string | null; loading: boolean; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

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
  }, [path, intervalMs, tick]);

  return { data, error, loading, refetch };
}

// WebSocket-based chat with the agent via persistent connection
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useWsChat(sessionKey?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const activeKeyRef = useRef<string | null>(null);
  const sessionRef = useRef(sessionKey);
  sessionRef.current = sessionKey;

  const send = useCallback(
    (text: string) => {
      const key = sessionRef.current || "mc:chat";
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      setStreaming(true);

      const id = mcWs.chatSend(key, text, {
        onDelta: (accumulated) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: accumulated,
            };
            return updated;
          });
        },
        onFinal: (finalText) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: finalText,
            };
            return updated;
          });
          setStreaming(false);
          activeKeyRef.current = null;
        },
        onError: (error) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant" && last.content === "") {
              updated[updated.length - 1] = {
                role: "assistant",
                content: `Error: ${error}`,
              };
            } else {
              updated.push({ role: "assistant", content: `Error: ${error}` });
            }
            return updated;
          });
          setStreaming(false);
          activeKeyRef.current = null;
        },
      });
      activeKeyRef.current = key;
    },
    [],
  );

  const reset = useCallback(() => {
    if (activeKeyRef.current) {
      mcWs.chatAbort(activeKeyRef.current);
      activeKeyRef.current = null;
    }
    setMessages([]);
    setStreaming(false);
  }, []);

  return { messages, streaming, send, reset };
}

// Subscribe to gateway connection status
export function useGatewayStatus(): boolean {
  return useSyncExternalStore(
    (cb) => mcWs.onStatus(cb),
    () => mcWs.gatewayConnected,
  );
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
