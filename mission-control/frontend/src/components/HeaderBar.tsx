import { useLocation } from "react-router-dom";
import { LiveClock } from "./LiveClock.js";

const PAGE_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/chat": "Chat",
  "/cron": "Cron Jobs",
  "/tasks": "Tasks",
  "/memory": "Memory & Workspace",
  "/skills": "Skills",
  "/usage": "Usage",
  "/settings": "Settings",
};

export function HeaderBar() {
  const location = useLocation();
  const pageName = PAGE_NAMES[location.pathname] ?? "Mission Control";

  return (
    <header className="h-14 shrink-0 border-b border-border bg-header-bg flex items-center justify-between px-5">
      <h1 className="text-base font-semibold text-text">{pageName}</h1>
      <LiveClock />
    </header>
  );
}
