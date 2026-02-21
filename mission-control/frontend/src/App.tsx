import { Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./components/Sidebar.js";
import { HeaderBar } from "./components/HeaderBar.js";
import { ChatWidget } from "./components/ChatWidget.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Chat } from "./pages/Chat.js";
import { Cron } from "./pages/Cron.js";
import { Settings } from "./pages/Settings.js";
import { Memory } from "./pages/Memory.js";
import { Skills } from "./pages/Skills.js";
import { Usage } from "./pages/Usage.js";
import { Tasks } from "./pages/Tasks.js";
import { useTheme } from "./lib/theme.js";

export function App() {
  // Initialize theme on mount
  useTheme();

  return (
    <div className="flex h-full bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <HeaderBar />
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/cron" element={<Cron />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/memory" element={<Memory />} />
              <Route path="/skills" element={<Skills />} />
              <Route path="/usage" element={<Usage />} />
              <Route path="/tasks" element={<Tasks />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
