export const THEME_STORAGE_KEY = "balance-theme";

export type Theme = "light" | "dark";

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return readStoredTheme() ?? "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures (private mode, blocked storage, etc.)
  }
}

export function initTheme() {
  applyTheme(getTheme());
}
