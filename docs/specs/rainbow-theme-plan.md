# Rainbow theme: implementation plan

Implements [rainbow-theme.md](rainbow-theme.md) in three phases. Paths are
relative to `apps/web`.

## Phase 1: Pure theme logic and tests (no visible change)

- New `src/lib/theme.ts` (pure, no DOM):
  - `ThemeMode = "light" | "dark" | "auto" | "rainbow"`, `THEME_MODES`.
  - `NEXT_MODE`: `auto→light→dark→rainbow→auto` (today `dark→auto`).
  - `parseThemeMode(stored)`: the four modes as-is, anything else → `auto`.
  - `resolveTheme(mode, prefersDark)`: `auto`/`rainbow` follow the OS.
  - `followsSystem(mode)`: true for `auto` and `rainbow` only.
- New `src/lib/theme.test.ts` covering the four test bullets in the spec.

Done when `bun test` passes.

## Phase 2: Wire the mode through the toggle and the init script

- `src/components/theme-toggle.tsx`
  - Drop the local `ThemeMode` / `NEXT_MODE` / `resolveTheme`; import from
    `#/lib/theme`.
  - `getInitialMode` uses `parseThemeMode(localStorage.getItem("theme"))`.
  - `MODE_LABEL.rainbow = "Rainbow"`, `MODE_ICON.rainbow = Rainbow` (lucide).
  - `applyThemeMode` removes `light`, `dark`, `rainbow`, adds the resolved
    class, then `rainbow` if the mode is rainbow. `data-theme` and
    `colorScheme` unchanged.
  - The media-query effect guards on `!followsSystem(mode)` and calls
    `applyThemeMode(mode)` (not hard-coded `"auto"`), or rainbow loses its
    class on an OS flip.
  - Rainbow label: "Theme mode: rainbow (follows system). Click to switch
    mode."
- `src/routes/__root.tsx` `THEME_INIT_SCRIPT`: accept `'rainbow'`, resolve it
  like `auto`, remove/add the `rainbow` class, and add a one-line comment
  naming `lib/theme.ts` as the source of truth.

Done when the button cycles all four modes and `<html>` carries
`light rainbow` / `dark rainbow` (no visual change yet).

## Phase 3: Rainbow accents and end-to-end check

- `src/components/header.tsx`: add `site-header` to the `<header>` className.
- `src/styles.css`:
  - `--rainbow-gradient` (90deg, oklch, red→violet) in the brand `:root` block.
  - After `.dark`: `.rainbow { --chart-1..5 }` at five even hues, L ≈ 0.62;
    `.dark.rainbow` the same hues at L ≈ 0.74.
  - `.rainbow .site-header::before`: `content: ""`, absolute,
    `inset-inline: 0`, `top: 0`, `height: 3px`, gradient background.
  - `.rainbow .nav-link::after { background: var(--rainbow-gradient); }`.
- Verify: `bun run check`, `bun test`, then in `bun run dev` walk the spec's
  "Done when" list.

## Risks

- The nav underline is 1px, so the gradient is subtle; the spec keeps it.
- The init script duplicates `lib/theme.ts` by hand with no test; review the
  two side by side.
- `::before` needs `content: ""` to render (the spec omits it).
