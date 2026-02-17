import { useState, useEffect, useCallback } from "react";

export type Theme = "navy" | "oled" | "light";

const STORAGE_KEY = "mc-theme";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "navy" || stored === "oled" || stored === "light") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return "navy";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return { theme, setTheme };
}
