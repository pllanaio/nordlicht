"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark", () => false);
  function toggleTheme() {
    const nextTheme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try { window.localStorage.setItem("contentdock-theme-v1", nextTheme); } catch { /* The selected theme remains usable without persistence. */ }
  }
  return <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Dunkles Erscheinungsbild" aria-pressed={dark} title={dark ? "Helles Erscheinungsbild aktivieren" : "Dunkles Erscheinungsbild aktivieren"}><Moon className="theme-toggle__moon" aria-hidden="true" /><Sun className="theme-toggle__sun" aria-hidden="true" /></button>;
}
