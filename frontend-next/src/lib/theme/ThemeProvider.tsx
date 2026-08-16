"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "tenderchain.theme";

/**
 * Inlined into <head> so the correct theme is applied before first paint.
 * Without it the page renders light, then snaps to dark on hydration.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var resolved = (stored === 'light' || stored === 'dark') ? stored : system;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {}
})();
`;

/* --------------------------------------------------------- preference store
 *
 * Both the stored preference and the OS setting are external state, and both
 * differ between server and client. They are read through useSyncExternalStore
 * rather than useState/useEffect so React can use a distinct server snapshot -
 * a lazy useState initialiser reading localStorage renders "system" on the
 * server and the stored value on the client, which is a hydration mismatch
 * React explicitly will not patch up.
 */

const listeners = new Set<() => void>();
let cachedPreference: ThemePreference | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function subscribeToPreference(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changing the theme should update this one.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedPreference = null;
      notify();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  // Cached because useSyncExternalStore requires a stable snapshot between
  // renders; reading localStorage every call would be fine value-wise but is
  // needless work on every render.
  if (cachedPreference !== null) return cachedPreference;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    cachedPreference =
      stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    cachedPreference = "system";
  }
  return cachedPreference;
}

/** The server cannot know the user's stored choice, so it assumes "system". */
function getPreferenceServerSnapshot(): ThemePreference {
  return "system";
}

/* ------------------------------------------------------------ system theme */

function subscribeToSystem(onChange: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSystemSnapshot(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getSystemServerSnapshot(): ResolvedTheme {
  return "light";
}

/* ---------------------------------------------------------------- provider */

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribeToPreference,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot
  );

  const systemTheme = useSyncExternalStore(
    subscribeToSystem,
    getSystemSnapshot,
    getSystemServerSnapshot
  );

  const resolved: ResolvedTheme =
    preference === "system" ? systemTheme : preference;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice will not persist, but
      // the in-memory cache below still applies it for this session.
    }
    cachedPreference = next;
    notify();
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}
