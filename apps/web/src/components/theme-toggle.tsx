import { Monitor, Moon, Rainbow, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  followsSystem,
  NEXT_MODE,
  parseThemeMode,
  resolveTheme,
  type ThemeMode,
} from "#/lib/theme";

const MODE_LABEL: Record<ThemeMode, string> = {
  auto: "Auto",
  dark: "Dark",
  light: "Light",
  rainbow: "Rainbow",
};

const MODE_ICON = {
  auto: Monitor,
  dark: Moon,
  light: Sun,
  rainbow: Rainbow,
} as const;

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "auto";
  }

  return parseThemeMode(window.localStorage.getItem("theme"));
}

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(mode, prefersDark);

  document.documentElement.classList.remove("light", "dark", "rainbow");
  document.documentElement.classList.add(resolved);
  if (mode === "rainbow") {
    document.documentElement.classList.add("rainbow");
  }

  if (mode === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }

  document.documentElement.style.colorScheme = resolved;
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    const initialMode = getInitialMode();
    setMode(initialMode);
    applyThemeMode(initialMode);
  }, []);

  useEffect(() => {
    if (!followsSystem(mode)) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeMode(mode);

    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, [mode]);

  function toggleMode() {
    const nextMode = NEXT_MODE[mode];
    setMode(nextMode);
    applyThemeMode(nextMode);
    window.localStorage.setItem("theme", nextMode);
  }

  let label = `Theme mode: ${mode}. Click to switch mode.`;
  if (mode === "auto") {
    label = "Theme mode: auto (system). Click to switch to light mode.";
  } else if (mode === "rainbow") {
    label = "Theme mode: rainbow (follows system). Click to switch mode.";
  }

  const ModeIcon = MODE_ICON[mode];

  return (
    <Button
      aria-label={label}
      onClick={toggleMode}
      size="sm"
      title={label}
      type="button"
      variant="outline"
    >
      <ModeIcon />
      {MODE_LABEL[mode]}
    </Button>
  );
}
