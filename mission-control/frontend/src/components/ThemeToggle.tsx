import { Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "../lib/theme.js";

const options: { value: Theme; icon: typeof Moon; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-lg overflow-hidden border border-border bg-input-bg p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
            theme === value
              ? "bg-accent text-white shadow-sm"
              : "text-text-dim hover:text-text-muted"
          }`}
        >
          <Icon size={12} />
          {!collapsed && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
