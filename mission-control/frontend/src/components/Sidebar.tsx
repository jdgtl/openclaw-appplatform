import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Clock,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle.js";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/cron", icon: Clock, label: "Cron" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`glass-sidebar flex flex-col h-full shrink-0 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-52"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-separator">
        {!collapsed && (
          <span className="font-semibold text-sm text-text-primary whitespace-nowrap">
            Mission Control
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-text-tertiary hover:text-text-primary transition-colors"
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
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
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-control"
              }`
            }
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-separator flex justify-center">
        <ThemeToggle />
      </div>
    </aside>
  );
}
