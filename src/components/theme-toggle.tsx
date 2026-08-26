"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("contentdock-theme-v1", nextTheme);
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Farbschema wechseln" title="Hell/Dunkel wechseln">
      <Moon className="theme-toggle__moon" aria-hidden="true" />
      <Sun className="theme-toggle__sun" aria-hidden="true" />
      <span>Hell/Dunkel wechseln</span>
    </button>
  );
}
