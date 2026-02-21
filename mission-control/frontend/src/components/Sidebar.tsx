import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Clock,
  Settings,
  Brain,
  Puzzle,
  BarChart3,
  KanbanSquare,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle.js";
import { StatusDot } from "./StatusDot.js";
import { usePolling } from "../lib/hooks.js";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/cron", icon: Clock, label: "Cron" },
  { to: "/tasks", icon: KanbanSquare, label: "Tasks" },
  { to: "/memory", icon: Brain, label: "Memory" },
  { to: "/skills", icon: Puzzle, label: "Skills" },
  { to: "/usage", icon: BarChart3, label: "Usage" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface StatusBrief {
  agent: { name: string | null; status: string };
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { data: status } = usePolling<StatusBrief>("/status", 30_000);
  const agentName = status?.agent?.name ?? "Agent";
  const agentStatus = status?.agent?.status === "active" ? "active" as const : "error" as const;

  return (
    <aside
      className={`bg-sidebar-bg border-r border-border flex flex-col h-full shrink-0 transition-[width] duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        collapsed ? "w-16" : "w-[200px]"
      }`}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        {!collapsed ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
              SAUCE CREATIVE
            </span>
            <span className="text-[15px] font-bold text-text">
              Mission Control
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusDot status={agentStatus} size={6} />
              <span className="text-[11px] text-accent">{agentName}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-bold text-text">MC</span>
            <StatusDot status={agentStatus} size={6} />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-accent-bg text-accent"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"
              }`
            }
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border flex flex-col gap-2">
        <div className="flex justify-center">
          <ThemeToggle collapsed={collapsed} />
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center gap-1.5 text-text-dim hover:text-text transition-colors py-1"
        >
          <ChevronLeft
            size={14}
            className={`transition-transform duration-250 ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
