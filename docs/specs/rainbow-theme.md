# Rainbow theme mode

Add a fourth theme mode, Rainbow, that puts rainbow accents on top of the
normal light or dark surface. Sized to build in about 20 minutes.

## Decisions

| Question | Decision |
| --- | --- |
| What Rainbow looks like | **Accents only.** Surfaces, text, cards and borders stay exactly as in light/dark. No animation. |
| Light or dark underneath | **Follows the system**, like `auto`. Rainbow resolves to `light` or `dark` from `prefers-color-scheme` and keeps tracking OS changes. |
| Where it sits in the toggle | **After dark** in the existing button: `auto → light → dark → rainbow → auto`. No separate switch. |
| Which accents change | **Header strip, nav underline, chart colours.** A thin rainbow bar across the top of the header, a rainbow gradient for the nav-link underline, and `--chart-1..5` spread across five hues. Primary buttons, `--ring` and `--brand-label` stay terracotta, so contrast is unchanged. |
| Mode logic and tests | **Pure helper plus a unit test.** Move the cycle and resolve logic into `apps/web/src/lib/theme.ts` and test it. The inline init script is updated by hand to match. |

## Rules

1. `ThemeMode` is `"light" | "dark" | "auto" | "rainbow"`.
2. `rainbow` resolves like `auto`: `dark` if the OS prefers dark, else `light`.
3. On `<html>`, rainbow mode sets the resolved class plus `rainbow`
   (`class="light rainbow"` or `class="dark rainbow"`), `data-theme="rainbow"`,
   and `style.colorScheme` to the resolved value. Switching to any other mode
   removes the `rainbow` class.
4. `localStorage.theme` stores `"rainbow"`. Any value other than the four
   modes still falls back to `auto`.
5. The `prefers-color-scheme` listener in `ThemeToggle` runs for `auto` *and*
   `rainbow`.
6. Everything that reads only light vs dark (`useResolvedTheme`, the Toaster,
   Tailwind's `dark:` variant) needs no change: it keeps seeing `light`/`dark`.

## Layers / files

- **`apps/web/src/lib/theme.ts`** (new, pure, no DOM)
  - `export type ThemeMode`, `THEME_MODES`, `NEXT_MODE`
    (`auto→light→dark→rainbow→auto`).
  - `parseThemeMode(stored: string | null): ThemeMode` (unknown → `auto`).
  - `resolveTheme(mode, prefersDark): "light" | "dark"` (`auto` and `rainbow`
    follow `prefersDark`).
  - `followsSystem(mode): boolean` (`auto` or `rainbow`).
- **`apps/web/src/components/theme-toggle.tsx`**
  - Import the above instead of the local copies.
  - Add `rainbow` to `MODE_LABEL` ("Rainbow") and `MODE_ICON` (lucide
    `Rainbow`).
  - `applyThemeMode` removes `light`, `dark`, `rainbow`, adds the resolved
    class, then adds `rainbow` if the mode is rainbow. `data-theme` is set for
    every mode except `auto`, as today.
  - The media-query effect uses `followsSystem(mode)`.
  - Label for rainbow: "Theme mode: rainbow (follows system). Click to switch
    mode."
- **`apps/web/src/routes/__root.tsx`**: `THEME_INIT_SCRIPT` accepts
  `'rainbow'`, resolves it like `auto`, and adds the `rainbow` class, so a
  reload in rainbow mode doesn't flash plain accents. It's a string and can't
  import `lib/theme.ts`; add a one-line comment pointing at it as the source
  of truth.
- **`apps/web/src/components/header.tsx`**: add a `site-header` class to
  `<header>` so CSS can target it. No other markup change.
- **`apps/web/src/styles.css`**
  - In `:root`, a `--rainbow-gradient`: a 90deg `linear-gradient` through red,
    orange, yellow, green, blue, violet (oklch). One gradient for both
    surfaces; it's decorative and carries no text.
  - `.rainbow` (after the `.dark` block): `--chart-1..5` set to five evenly
    spaced hues at around L 0.62. `.dark.rainbow`: the same hues lightened to
    around L 0.74 so they read on ink.
  - `.rainbow .site-header::before`: absolutely positioned, `inset-inline: 0`,
    `top: 0`, `height: 3px`, `background: var(--rainbow-gradient)`. The header
    is already `sticky`, so it's the containing block.
  - `.rainbow .nav-link::after { background: var(--rainbow-gradient); }`.

No changes to `packages/db`, `packages/services`, tRPC or D1. The theme is
per-browser, as today.

## Tests (`apps/web/src/lib/theme.test.ts`, run by `bun test src`)

- `NEXT_MODE` walks `auto → light → dark → rainbow → auto`.
- `resolveTheme("rainbow", true)` is `dark`; `resolveTheme("rainbow", false)`
  is `light`. `light`/`dark` ignore `prefersDark`.
- `parseThemeMode` returns each of the four modes as-is, and `auto` for
  `null`, `""` and `"purple"`.
- `followsSystem` is true only for `auto` and `rainbow`.

## Out of scope

- Animated or hue-cycling gradients.
- Rainbow primary buttons, focus ring, kicker labels, or tinted surfaces.
- A rainbow-specific background or a separate rainbow on/off switch.
- Pages that use the chart tokens (none exist yet; the chart colours are
  ready for when one does).
- Saving the theme per member on the server.

## Done when

`bun test` and `bun run check` pass, and in `bun run dev`: the header button
cycles Auto → Light → Dark → Rainbow → Auto; in Rainbow the header shows the
rainbow strip and the active nav link has a rainbow underline; reloading keeps
Rainbow with no flash; switching the OS between light and dark flips the
surface while the rainbow accents stay; and leaving Rainbow removes both
accents.
