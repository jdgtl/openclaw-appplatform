import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Construction } from "lucide-react";

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-5 right-5 z-50 w-[360px] glass-window flex flex-col"
          >
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
            <div className="px-4 py-6 flex flex-col items-center gap-3 text-center">
              <Construction size={24} className="text-warning" />
              <p className="text-sm text-text-secondary">
                Chat requires WebSocket support — coming soon.
              </p>
              <p className="text-xs text-text-quaternary">
                Use Slack or the Sessions page to talk to the agent.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
