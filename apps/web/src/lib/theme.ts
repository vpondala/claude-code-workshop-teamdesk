// Pure theme-mode logic shared by the toggle and tests. No DOM access here.
// The inline init script in routes/__root.tsx is a string and cannot import
// this file, so it is kept in step by hand.

export type ThemeMode = "light" | "dark" | "auto" | "rainbow";

export const THEME_MODES: readonly ThemeMode[] = [
  "auto",
  "light",
  "dark",
  "rainbow",
];

/** The mode the toggle moves to on click. */
export const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  auto: "light",
  dark: "rainbow",
  light: "dark",
  rainbow: "auto",
};

/** Returns the stored value if it is a known mode, otherwise "auto". */
export function parseThemeMode(stored: string | null): ThemeMode {
  return (THEME_MODES as readonly string[]).includes(stored ?? "")
    ? (stored as ThemeMode)
    : "auto";
}

/** The light or dark surface a mode shows. Rainbow follows the system. */
export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean
): "light" | "dark" {
  if (mode === "light" || mode === "dark") {
    return mode;
  }
  return prefersDark ? "dark" : "light";
}

/** True when the mode tracks the OS colour scheme. */
export function followsSystem(mode: ThemeMode): boolean {
  return mode === "auto" || mode === "rainbow";
}
