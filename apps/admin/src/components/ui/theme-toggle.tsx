'use client';

import { useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'qrhub-theme';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // The blocking init script (root layout) already set data-theme before
    // paint; read that back rather than re-deriving from localStorage so
    // this can never disagree with what's actually on screen. Deferred a
    // tick so this reads as reacting to the DOM, not a synchronous effect
    // setState.
    queueMicrotask(() => {
      const current = document.documentElement.dataset.theme as Theme | undefined;
      setTheme(current ?? (systemPrefersDark() ? 'dark' : 'light'));
    });
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border-color text-sm transition-colors hover:bg-border-color/40"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
