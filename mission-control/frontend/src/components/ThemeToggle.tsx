import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "../lib/theme.js";

const themes: { value: Theme; icon: typeof Moon; label: string }[] = [
  { value: "navy", icon: Monitor, label: "Navy" },
  { value: "oled", icon: Moon, label: "OLED" },
  { value: "light", icon: Sun, label: "Light" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`p-1.5 transition-colors ${
            theme === value
              ? "bg-accent/20 text-accent"
              : "text-text-tertiary hover:text-text-secondary hover:bg-surface-control"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
