import { Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./components/Sidebar.js";
import { ChatWidget } from "./components/ChatWidget.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Chat } from "./pages/Chat.js";
import { Cron } from "./pages/Cron.js";
import { useTheme } from "./lib/theme.js";

export function App() {
  // Initialize theme on mount
  useTheme();

  return (
    <div className="flex h-full bg-surface-base">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/cron" element={<Cron />} />
          </Routes>
        </AnimatePresence>
      </main>
      <ChatWidget />
    </div>
  );
}
