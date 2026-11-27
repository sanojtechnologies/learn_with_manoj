# Design: LearnwithManoj

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: editorial
- Shape of the first page: Ecosystem Index (latest episode, the series as syllabi, latest posts, videos, FAQ)
- Theme: brand (the ink blue and the YouTube red kept from the site; vibe: "a technical journal for a video series")
- Axes: light/roman-serif/cool · posture: Restrained

## Tokens
`src/styles/tokens.css` is the source of truth; dark values live in `src/styles/global.css`. The roles:
```css
:root {
  --color-paper: oklch(98.2% 0.004 255);  --color-paper-2: oklch(95.6% 0.008 255);  --color-paper-3: oklch(92.4% 0.012 255);
  --color-ink: oklch(20% 0.02 258);  --color-ink-2: oklch(34% 0.024 258);  --color-muted: oklch(47% 0.022 258);  --color-rule: oklch(88.5% 0.012 255);
  --color-accent: oklch(52% 0.19 257);  --color-accent-ink: oklch(99% 0.004 255);  --color-focus: oklch(54% 0.2 257);
  --color-signal: oklch(56% 0.22 25);  /* YouTube red: Subscribe and play only */
  --font-display: "Source Serif 4 Variable", Georgia, serif;  --font-body: system-ui stack;  --font-outlier: the code mono;
  --radius-card: 4px;  --radius-pill: 999px;  --rule-hair: 1px;  --shadow-card: none;
}
```
The spacing scale, the type scale, the easings and the durations are the scaffold's and live in `tokens.css`.

## Controls
- Primary: ink fill · 4px radius · 44px tall (`.btn`)
- Signal: YouTube red fill, only for Subscribe and play (`.btn--signal`)
- Secondary: hairline outline · same radius and height (`.btn--quiet`)

## Surfaces
Whitespace, then hairlines (`--color-rule`), then a tinted well (`--color-paper-2`). No bordered cards: lists are rows, indexes and rails.

## Motion
- Character: still. Colour transitions on hover only; no reveals. Under reduced motion everything ends at once.

## Exports
`src/styles/tokens.css` is a Tailwind v4 `@theme static` block, so every role is a utility (`bg-paper`, `text-ink`, `font-display`).
