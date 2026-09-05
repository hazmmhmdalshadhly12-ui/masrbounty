# MasrBounty Design System

Single source of truth for UI. Every new page must reuse these tokens/components.

## Colors
- Ink: slate-900 (#0a1628 custom navy for brand surfaces)
- Accent: amber-400 on dark, amber-600 on light — sparingly (CTAs, highlights only)
- Neutrals: slate scale; muted text via `text-muted-foreground`
- Status: green (resolved/paid/verified), amber (pending), red (destructive/banned), blue (info/submitted)
- Never: emojis in UI, glow effects, hacker imagery

## Typography
- Arabic-first: Cairo (headings 800-900), body Cairo/Inter
- Mono: JetBrains Mono for IDs, hashes, amounts (`dir="ltr"`)
- Scale: page h1 2xl-3xl black tracking-tight; section titles bold; body sm relaxed

## Components (reuse, don't reinvent)
- Buttons: `components/ui/button` (default slate-900 / amber CTA / outline / ghost / destructive)
- Cards: `components/ui/card`; stat cards: title xs muted + 2xl black tabular-nums
- Status: `components/shared/status-pill` (Arabic labels,Kind status|severity)
- Tables: bordered, `bg-muted/50` thead, right-aligned in RTL, `overflow-x-auto` + min-width, hover row
- States: empty (icon + bold + muted hint), loading (`loading.tsx` skeletons), error (`error.tsx` Arabic + digest ref), success (green banner via ?ok=)
- Forms: Label + Input/Textarea/select h-10, inline red error, disabled busy buttons
- Charts: Recharts wrappers in `components/charts` (always `dir="ltr"` container)

## Layout
- Public: PageHero (navy band + kicker) → container content
- Dashboards: DashboardShell (dark sidebar, active amber) → content, mobile horizontal scroll nav + bottom nav
- Mobile-first: touch targets ≥44px, full-width forms, no horizontal scroll except tables

## Motion & a11y
- Quiet transitions only; `prefers-reduced-motion` disables animation globally
- `:focus-visible` ring everywhere; skip-link; aria-labels on icon buttons; semantic table/nav/main
- RTL default (`dir=rtl`), LTR islands via `dir="ltr"` for code/numbers/URLs
