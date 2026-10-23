import { describe, expect, test } from "bun:test";
import {
  followsSystem,
  NEXT_MODE,
  parseThemeMode,
  resolveTheme,
  type ThemeMode,
} from "./theme.ts";

describe("theme", () => {
  test("NEXT_MODE walks auto → light → dark → rainbow → auto", () => {
    expect(NEXT_MODE.auto).toBe("light");
    expect(NEXT_MODE.light).toBe("dark");
    expect(NEXT_MODE.dark).toBe("rainbow");
    expect(NEXT_MODE.rainbow).toBe("auto");
  });

  test("rainbow and auto follow prefersDark", () => {
    expect(resolveTheme("rainbow", true)).toBe("dark");
    expect(resolveTheme("rainbow", false)).toBe("light");
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
  });

  test("light and dark ignore prefersDark", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  test("parseThemeMode returns each known mode as-is", () => {
    const modes: ThemeMode[] = ["auto", "light", "dark", "rainbow"];
    for (const mode of modes) {
      expect(parseThemeMode(mode)).toBe(mode);
    }
  });

  test("parseThemeMode falls back to auto for missing or unknown values", () => {
    expect(parseThemeMode(null)).toBe("auto");
    expect(parseThemeMode("")).toBe("auto");
    expect(parseThemeMode("purple")).toBe("auto");
  });

  test("followsSystem is true only for auto and rainbow", () => {
    expect(followsSystem("auto")).toBe(true);
    expect(followsSystem("rainbow")).toBe(true);
    expect(followsSystem("light")).toBe(false);
    expect(followsSystem("dark")).toBe(false);
  });
});
