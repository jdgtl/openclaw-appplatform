import { useState, useRef, useEffect } from "react";
import { PageShell } from "../components/PageShell.js";
import { usePolling, useWsChat, useGatewayStatus } from "../lib/hooks.js";
import { fetchJSON } from "../lib/api.js";
import {
  Search,
  Send,
  Loader2,
  MessageSquare,
  Plus,
  WifiOff,
  Pencil,
} from "lucide-react";

interface Session {
  key: string;
  channel?: string;
  displayName?: string;
  updatedAt?: number;
}

interface SessionsResponse {
  sessions?: Session[];
}

interface HistoryMessage {
  role: string;
  content: string;
}

const CHANNEL_ICONS: Record<string, string> = {
  slack: "\u{1F4AC}",
  whatsapp: "\u{1F4F1}",
  mc: "\u{1F5A5}\uFE0F",
  "mission control": "\u{1F5A5}\uFE0F",
  discord: "\u{1F3AE}",
};

export function Chat() {
  const { data: sessionsData } = usePolling<SessionsResponse>("/sessions", 30_000);
  const sessions = sessionsData?.sessions ?? [];

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sendInput, setSendInput] = useState("");

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [hoverSession, setHoverSession] = useState<string | null>(null);
  const [sessionNames, setSessionNames] = useState<Record<string, string>>({});

  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
  const { messages: wsMessages, streaming, send: wsSend, reset: wsReset } =
    useWsChat(activeSessionKey ?? undefined);
  const gatewayConnected = useGatewayStatus();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, wsMessages, streaming]);

  const filteredSessions = sessions.filter(
    (s) =>
      !search ||
      s.key.toLowerCase().includes(search.toLowerCase()) ||
      s.channel?.toLowerCase().includes(search.toLowerCase()) ||
      s.displayName?.toLowerCase().includes(search.toLowerCase()),
  );

  const loadSession = async (key: string) => {
    setSelectedKey(key);
    setActiveSessionKey(key);
    wsReset();
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

  const startNewChat = () => {
    setSelectedKey(null);
    setActiveSessionKey("mc:chat");
    wsReset();
    setHistory([]);
    setSendInput("");
  };

  const handleSend = () => {
    const text = sendInput.trim();
    if (!text || streaming || !gatewayConnected) return;
    setSendInput("");
    wsSend(text);
  };

  const getSessionName = (s: Session) =>
    sessionNames[s.key] ?? s.displayName ?? s.key;

  const allMessages = [...history, ...wsMessages];
  const isActive = activeSessionKey !== null;

  return (
    <PageShell title="Chat">
      <div className="flex gap-0 h-[calc(100vh-8rem)] min-h-0 border border-border rounded-xl overflow-hidden">
        {/* Session list */}
        <div className="w-[280px] shrink-0 bg-sidebar-bg border-r border-border flex flex-col">
          <div className="p-4">
            <div className="flex items-center gap-2 bg-input-bg rounded-lg px-2.5 py-1.5 border border-input-border">
              <Search size={14} className="text-text-faint" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint outline-none"
              />
            </div>
          </div>
          <button
            onClick={startNewChat}
            className={`mx-4 mb-3 px-4 py-2.5 rounded-lg text-[13px] font-medium flex items-center gap-2 border transition-colors ${
              activeSessionKey === "mc:chat" && !selectedKey
                ? "bg-accent-bg border-accent-border text-accent"
                : "border-border text-text-muted hover:bg-surface-hover"
            }`}
          >
            <Plus size={14} />
            New Conversation
          </button>
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.map((s) => {
              const channelIcon = CHANNEL_ICONS[s.channel?.toLowerCase() ?? ""] ?? "\u{1F4AC}";
              const isSelected = selectedKey === s.key;
              const isEditing = editingTitle === s.key;

              return (
                <div
                  key={s.key}
                  onClick={() => { loadSession(s.key); if (!isEditing) setEditingTitle(null); }}
                  onMouseEnter={() => setHoverSession(s.key)}
                  onMouseLeave={() => setHoverSession(null)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-accent-bg border-l-2 border-l-accent"
                      : "border-l-2 border-l-transparent hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onBlur={() => {
                          setSessionNames((prev) => ({ ...prev, [s.key]: editTitleValue }));
                          setEditingTitle(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setSessionNames((prev) => ({ ...prev, [s.key]: editTitleValue }));
                            setEditingTitle(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[13px] text-text font-medium bg-input-bg border border-accent-border rounded px-1.5 py-0.5 outline-none w-full font-mono"
                      />
                    ) : (
                      <span className={`text-[13px] font-medium flex-1 truncate ${isSelected ? "text-text" : "text-text-muted"}`}>
                        {getSessionName(s)}
                      </span>
                    )}
                    {hoverSession === s.key && !isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTitleValue(getSessionName(s));
                          setEditingTitle(s.key);
                        }}
                        className="text-accent shrink-0 p-0.5"
                        style={{ animation: "fadeIn 0.15s ease" }}
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{channelIcon}</span>
                      <span className="text-[11px] text-text-dim">{s.channel ?? "mc"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredSessions.length === 0 && (
              <p className="text-xs text-text-faint text-center mt-4">
                No sessions found
              </p>
            )}
          </div>
        </div>

        {/* Message area */}
        <div className="flex-1 flex flex-col bg-bg">
          {/* Header */}
          {isActive && (
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <MessageSquare size={14} className="text-text-dim" />
              <span className="text-sm text-text font-medium">
                {selectedKey
                  ? getSessionName(sessions.find((s) => s.key === selectedKey) ?? { key: selectedKey })
                  : "New Conversation"}
              </span>
              {!gatewayConnected && (
                <span className="ml-auto flex items-center gap-1.5 text-xs text-warning">
                  <WifiOff size={12} />
                  Gateway disconnected
                </span>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {historyLoading ? (
              <div className="flex items-center justify-center h-full text-text-dim">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : isActive ? (
              allMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-text-faint text-sm">
                  Send a message to start chatting
                </div>
              ) : (
                allMessages.map((msg, i) => (
                  <MessageBubble key={i} role={msg.role} content={msg.content} />
                ))
              )
            ) : (
              <div className="flex items-center justify-center h-full text-text-faint text-sm">
                Select a session or start a new conversation
              </div>
            )}
            {streaming && (
              <div className="self-start text-text-dim">
                <Loader2 size={14} className="animate-spin" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {isActive && (
            <div className="px-5 py-3 border-t border-border">
              <div className="flex items-center gap-2 bg-input-bg rounded-lg px-3 py-2 border border-input-border focus-within:border-accent transition-colors">
                <input
                  type="text"
                  placeholder="Send a message..."
                  value={sendInput}
                  onChange={(e) => setSendInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) handleSend();
                  }}
                  className="flex-1 bg-transparent text-sm text-text placeholder:text-text-faint outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={streaming || !sendInput.trim() || !gatewayConnected}
                  className="text-accent disabled:opacity-30 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] px-4 py-3 rounded-xl ${
          isUser
            ? "bg-accent-bg border border-accent-border"
            : "bg-card-bg border border-border"
        }`}
      >
        <p className="text-[13px] text-text leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
        <span className="text-[10px] text-text-faint mt-1.5 block">{timeStr}</span>
      </div>
    </div>
  );
}
