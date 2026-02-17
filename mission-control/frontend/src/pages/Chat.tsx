import { useState, useRef, useEffect } from "react";
import { PageShell } from "../components/PageShell.js";
import { GlassCard } from "../components/GlassCard.js";
import { usePolling, useSSEChat } from "../lib/hooks.js";
import { fetchJSON, postJSON } from "../lib/api.js";
import {
  Search,
  Send,
  Loader2,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

interface Session {
  key: string;
  channel?: string;
  createdAt?: string;
  lastActivity?: string;
  transcriptPath?: string;
}

interface SessionsResponse {
  sessions?: Session[];
}

interface HistoryMessage {
  role: string;
  content: string;
  timestamp?: string;
}

export function Chat() {
  const { data: sessionsData } = usePolling<SessionsResponse>(
    "/sessions",
    30_000,
  );
  const sessions = sessionsData?.sessions ?? [];

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sendInput, setSendInput] = useState("");
  const [newChatInput, setNewChatInput] = useState("");
  const [sending, setSending] = useState(false);

  // New conversation mode
  const [newChat, setNewChat] = useState(false);
  const { messages: sseMessages, streaming, send: sseSend } = useSSEChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, sseMessages, streaming]);

  const filteredSessions = sessions.filter(
    (s) =>
      !search ||
      s.key.toLowerCase().includes(search.toLowerCase()) ||
      s.channel?.toLowerCase().includes(search.toLowerCase()),
  );

  const loadHistory = async (key: string) => {
    setSelectedKey(key);
    setNewChat(false);
    setHistoryLoading(true);
    try {
      const data = await fetchJSON<{ messages: HistoryMessage[] }>(
        `/sessions/${key}/history`,
      );
      setHistory(data.messages ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSendToSession = async () => {
    const text = sendInput.trim();
    if (!text || !selectedKey || sending) return;
    setSendInput("");
    setSending(true);
    try {
      await postJSON(`/sessions/${selectedKey}/send`, { message: text });
      // Reload history after send
      await loadHistory(selectedKey);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const startNewChat = () => {
    setSelectedKey(null);
    setNewChat(true);
    setNewChatInput("");
    setHistory([]);
  };

  const handleNewChatSend = () => {
    const text = newChatInput.trim();
    if (!text || streaming) return;
    setNewChatInput("");
    sseSend(text);
  };

  return (
    <PageShell title="Chat">
      <div className="flex gap-4 h-[calc(100vh-8rem)] min-h-0">
        {/* Session list */}
        <GlassCard className="w-72 shrink-0 flex flex-col !p-0 overflow-hidden">
          <div className="p-3 border-b border-separator">
            <div className="flex items-center gap-2 bg-surface-input rounded-lg px-2.5 py-1.5">
              <Search size={14} className="text-text-quaternary" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-quaternary outline-none"
              />
            </div>
          </div>
          <button
            onClick={startNewChat}
            className={`mx-3 mt-3 mb-1 text-sm px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              newChat
                ? "bg-accent/15 text-accent"
                : "text-text-secondary hover:bg-surface-control"
            }`}
          >
            <MessageSquare size={14} />
            New Conversation
          </button>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredSessions.map((s) => (
              <button
                key={s.key}
                onClick={() => loadHistory(s.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  selectedKey === s.key
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:bg-surface-control"
                }`}
              >
                <div className="truncate">
                  <p className="font-medium truncate">{s.key}</p>
                  {s.channel && (
                    <p className="text-xs text-text-quaternary">{s.channel}</p>
                  )}
                </div>
                <ChevronRight size={14} className="shrink-0 opacity-40" />
              </button>
            ))}
            {filteredSessions.length === 0 && (
              <p className="text-xs text-text-quaternary text-center mt-4">
                No sessions found
              </p>
            )}
          </div>
        </GlassCard>

        {/* Message area */}
        <GlassCard className="flex-1 flex flex-col !p-0 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {historyLoading ? (
              <div className="flex items-center justify-center h-full text-text-tertiary">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : newChat ? (
              // New chat messages from SSE
              sseMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-text-quaternary text-sm">
                  Start a new conversation
                </div>
              ) : (
                sseMessages.map((msg, i) => (
                  <MessageBubble
                    key={i}
                    role={msg.role}
                    content={msg.content}
                  />
                ))
              )
            ) : selectedKey ? (
              // Existing session history
              history.length === 0 ? (
                <div className="flex items-center justify-center h-full text-text-quaternary text-sm">
                  No messages in this session
                </div>
              ) : (
                history.map((msg, i) => (
                  <MessageBubble
                    key={i}
                    role={msg.role as "user" | "assistant"}
                    content={msg.content}
                  />
                ))
              )
            ) : (
              <div className="flex items-center justify-center h-full text-text-quaternary text-sm">
                Select a session or start a new conversation
              </div>
            )}
            {streaming && (
              <div className="self-start text-text-tertiary">
                <Loader2 size={14} className="animate-spin" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {(newChat || selectedKey) && (
            <div className="px-4 py-3 border-t border-separator">
              <div className="flex items-center gap-2 bg-surface-input rounded-lg px-3 py-2">
                <input
                  type="text"
                  placeholder="Send a message..."
                  value={newChat ? newChatInput : sendInput}
                  onChange={(e) =>
                    newChat
                      ? setNewChatInput(e.target.value)
                      : setSendInput(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      newChat ? handleNewChatSend() : handleSendToSession();
                    }
                  }}
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-quaternary outline-none"
                />
                <button
                  onClick={() =>
                    newChat ? handleNewChatSend() : handleSendToSession()
                  }
                  disabled={sending || streaming}
                  className="text-accent disabled:opacity-30 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </PageShell>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: string;
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div
      className={`text-sm leading-relaxed whitespace-pre-wrap max-w-[80%] ${
        isUser
          ? "self-end bg-accent/15 text-text-primary rounded-2xl rounded-br-md px-3 py-2"
          : "self-start text-text-secondary"
      }`}
    >
      {content}
    </div>
  );
}
