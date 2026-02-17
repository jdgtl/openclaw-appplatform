import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { useSSEChat } from "../lib/hooks.js";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, streaming, send } = useSSEChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    send(text);
  };

  return (
    <>
      {/* Toggle button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:brightness-110 transition-all"
          >
            <MessageSquare size={20} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-5 right-5 z-50 w-[360px] h-[480px] glass-window flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-separator">
              <span className="text-sm font-medium text-text-primary">
                Quick Chat
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-text-tertiary hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "self-end bg-accent/15 text-text-primary rounded-2xl rounded-br-md px-3 py-2 max-w-[85%]"
                      : "self-start text-text-secondary max-w-[90%]"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {streaming && (
                <div className="self-start text-text-tertiary">
                  <Loader2 size={14} className="animate-spin" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-separator">
              <div className="flex items-center gap-2 bg-surface-input rounded-lg px-3 py-2">
                <input
                  type="text"
                  placeholder="Send a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-quaternary outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="text-accent disabled:opacity-30 transition-opacity"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
