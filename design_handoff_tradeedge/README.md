# Handoff: TradeEdge — Landing Page + App Dashboard

## Overview

TradeEdge is a trading journal built specifically for **prop firm traders** managing multiple accounts (FTMO, TopStep, Apex, Tradeify, etc.). This handoff covers two things:

1. **`TradeEdge Landing.html`** — public marketing page (hero, features, compare, pricing, FAQ)
2. **`TradeEdge Hi-Fi.html`** — the authenticated app (Dashboard, Log a trade, Calendar, Stats — wrapped in a design canvas for review)

These were built across multiple design rounds with the founder. The visual direction is **editorial-meets-trading-terminal**: warm beige/amber palette, Fraunces serif for personality, Inter sans for numbers and UI, generous whitespace, hairline rules instead of heavy boxes.

---

## About the design files

The HTML files in this bundle are **design references**, not production code. They use inline `<style>` blocks, `type="text/babel"` JSX (transpiled in-browser), and a few starter helpers (`design-canvas.jsx`, `tweaks-panel.jsx`) that exist only for review purposes.

Your job, with Claude Code, is to **rebuild these designs inside the real TradeEdge codebase** — using the project's framework, component library, and routing — not to ship the HTML directly.

The user's stack is **GitHub + Supabase + Cloudflare**, so the most likely shape of the real app is a Next.js / Astro / React app on Cloudflare Pages with Supabase for auth + database. Claude Code should confirm the existing setup before scaffolding anything new.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, and component states are all locked in — recreate pixel-perfectly using the codebase's existing libraries and patterns.

---

## Stack guidance for the rebuild

When Claude Code opens the real repo, it should:

1. **Check `package.json` first** to confirm framework (Next.js? Astro? Vite + React?)
2. **Check for an existing component library** (shadcn/ui, Radix, Tailwind, plain CSS modules?)
3. **Check Supabase schema** — there's likely an existing `accounts`, `trades`, `firms` shape to reuse
4. **Match the existing folder conventions** — don't impose a new structure

If the repo is empty / pre-launch, recommend:
- **Next.js 14+ App Router** for landing + app (single repo, route-grouped: `(marketing)` for landing, `(app)` for dashboard)
- **Tailwind CSS** with a custom theme matching the design tokens below
- **Supabase JS client** for auth + data
- **Deploy to Cloudflare Pages** via GitHub Actions

---

## Design tokens

These are the canonical values. Drop them into your Tailwind config / CSS variables.

### Colors — Light mode (default for landing + app)

```css
--bg:          #FBF7EE;  /* page background, warm cream */
--bg2:         #F6F0E0;  /* secondary band background */
--surface:     #FFFCF4;  /* cards, raised surfaces */
--sidebar:     #F1EADA;  /* sidebar panel */
--border:      #D6CDB8;  /* primary hairline borders */
--border-soft: #E5DCC4;  /* subtle dividers */
--text:        #1A1614;  /* primary text, near-black warm */
--text-2:      #5B524A;  /* secondary body text */
--text-3:      #8A8076;  /* muted captions, labels */
--accent:      #C2521C;  /* brand amber / terracotta — primary CTA */
--accent-soft: rgba(194, 82, 28, 0.08);
--accent-soft-2: rgba(194, 82, 28, 0.14);
--warn:        #A33A28;  /* losses, drawdown warnings */
--warn-soft:   rgba(163, 58, 40, 0.08);
```

### Colors — Dark mode (app supports both)

```css
--bg:          #1C1613;
--sidebar:     #231B16;
--surface:     #251D18;
--surface-2:   #1C1613;
--border:      #3D2E25;
--border-soft: #2B211B;
--text:        #F0E6D8;
--text-2:      #A89687;
--text-3:      #7A6A5C;
--accent:      #E07A3B;  /* slightly brighter amber for dark */
--accent-soft: rgba(224, 122, 59, 0.10);
--accent-soft-2: rgba(224, 122, 59, 0.18);
--warn:        #C65A45;
--warn-soft:   rgba(198, 90, 69, 0.10);
```

### Typography

Three families, loaded from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

| Family | Use |
|---|---|
| **Fraunces** (serif) | Display headings, brand wordmark, italic accents — gives the "editorial" feel |
| **Inter** (sans) | All body copy, numbers, UI labels, buttons. Use `font-variant-numeric: tabular-nums` for any column of numbers |
| **JetBrains Mono** | Timestamps, monospace data, eyebrow micro-labels (sparingly) |

**Type scale (landing page):**
- H1 hero: Fraunces 76px / line-height 1.02 / letter-spacing -0.04em / weight 400
- Section title: Fraunces 52px / line-height 1.05 / letter-spacing -0.03em / weight 400
- Final CTA: Fraunces 64px
- Body: Inter 17–18px / line-height 1.55
- Eyebrow labels: Inter 11px / letter-spacing 0.16em / uppercase
- Buttons: Inter 13.5–15px / weight 500

**Type scale (app):**
- Page title: Inter 30px / weight 600 / letter-spacing -0.02em (NOT serif — the user explicitly preferred sans for app data screens)
- Hero numbers (P&L, etc.): Inter 42–58px / weight 600 / tabular-nums
- Card titles: Inter 16px / weight 600 / letter-spacing -0.01em
- Body: Inter 13–14px
- Eyebrow labels: Inter 10–11px / letter-spacing 0.12em–0.16em / uppercase / muted

**Italic accents:** In headings, key nouns are wrapped in `<em>` and rendered Fraunces italic in `--accent` color. Examples: "Log a *trade*.", "*Finally.*", "Stop the *fragmentation*." Use sparingly — once per heading max.

### Spacing

Tailwind default scale works fine. Common values used:
- Page gutters: 32px (landing), 44px (app)
- Section padding: 100px vertical
- Card padding: 18–28px
- Card gap: 12–14px
- Border radius: 6px (calendar tiles), 8–12px (form inputs, small buttons), 12–16px (cards), 14–18px (large cards), 100px (pill badges)

### Shadows

Use sparingly. Most depth is achieved through 1px hairline borders, not shadows.

- Hero product mock: `0 30px 80px -20px rgba(60,40,20,0.18), 0 8px 24px -8px rgba(60,40,20,0.08)`
- Featured pricing card: `0 20px 50px -16px rgba(194,82,28,0.25)`

---

## Pages / Screens

### 1. Landing page (`TradeEdge Landing.html`)

**Sections, in order:**

| Section | Purpose | Notes |
|---|---|---|
| Sticky nav | Logo · Features · Compare · Pricing · FAQ · Sign in · Start free trial | Backdrop-blur with 85% bg opacity |
| Hero | Headline, sub, dual CTA, reassurance row, product mock | Headline: "One dashboard for all your *prop firm accounts*." |
| Hero product mock | Embedded preview of the dashboard | 5 firms summary + 3 firm cards with payout progress + Apex card showing drawdown warning state |
| Logo strip | Supported firms (FTMO, TopStep, Apex, Tradeify, MyFundedFutures, The5%ers, FundedNext) | Set in Fraunces, muted |
| Pain points | 4 numbered pains in a list, sticky pull-quote on right | Pull quote: "I had eight tabs open just to know if I was up or down for the month..." |
| Features grid | 6-up asymmetric grid: 4-wide hero, then 2-third + 2× half + 2× half | Each card has number, title, description, mini visual |
| Compare table | Dark section. TradeEdge column highlighted with accent-soft background and amber borders | Compares vs TradeZella, Prop Firm One, PFT |
| Pricing | Two cards: Starter (free) + Pro ($19/mo) | Pro features a "Add backtesting +$10/mo" dashed-border add-on block below the feature list |
| FAQ | 5 expandable questions | Plus icons in accent color |
| Final CTA | Big centered Fraunces headline + dual CTA | "Stop the *fragmentation*." |
| Footer | Brand col + Product/Resources/Company link cols + legal disclaimer | |

**Pricing details (current):**
- Starter: $0/mo — up to 2 accounts, manual entry, basic stats, 14 days history
- Pro: $19/mo — unlimited accounts, auto imports, drawdown alerts, ROI analytics, AI news, unlimited history
- **Backtesting add-on: +$10/mo** — 5 years tick data. Sold separately, not in the Pro list

**CTAs:**
- Primary CTA copy: "Start free trial →"
- Secondary on hero: "See it live"
- Both lead to the app/signup flow

### 2. App: Dashboard (`TradeEdge Hi-Fi.html` → Dashboard frame)

Sidebar (220px) + main content area. Sidebar persists across all app screens.

**Sidebar contents:**
- Wordmark + "journal · Vol. IV" italic byline
- Nav items: Today (active = italic Fraunces 16px with 2px accent left-border), Log a trade, Calendar, History, Stats, Insights, Market brief, Community
- April goal card (progress bar in accent-soft tinted card)
- Avatar + user name + "Pro · 5-day streak"

**Main content:**
1. Editorial header — date eyebrow + clock readout right-aligned (mono)
2. "Good afternoon, Jake." in Inter 30px / weight 600, "Jake" in accent
3. Sub copy with inline P&L
4. Hairline rule
5. Three-up hero stats: Today's P&L (large, accent), Win rate, Streak — all Inter sans, tabular numbers
6. Hairline rule
7. Equity curve sparkline + pull-quote with accent left border
8. Hairline rule
9. Three structured cards (boxed): Win streak, Risk · today, Pattern (AI nudge)
10. Recent trades editorial list — symbol, description, P&L, rating

### 3. App: Log a trade

Single-column form (max-width 780px). Setup chips were removed in favor of a freeform "thought process" Fraunces italic textarea.

**Order:**
1. Editorial header ("Log a *trade*.")
2. Win/Loss outcome toggle (large rounded buttons, accent or warn tinted when active)
3. Trade details card (Symbol, Direction, Entry, Exit, Quantity, P&L) — 2-col grid, mono font for numbers
4. Rating row: A/B/C/D pills with descriptive labels (Perfect/Good/Average/Poor)
5. **Thought process** — large Fraunces italic textarea, no chip system
6. Screenshot drop zone (dashed border)
7. Save row: primary "Save trade" + ghost "Save & log another" + auto-saved indicator

### 4. App: Calendar

Month view. Header has navigation chevrons + month/year readout (mono).

Summary row: month-to-date P&L, trade count, win rate, trading days used.

7-col grid of day tiles (35 cells for 5 weeks). Each tile:
- Day number top-left (bolder if today, accent-bordered if today)
- P&L bottom — **Inter sans, weight 600, tabular-nums** (NOT serif — user explicitly chose sans here for legibility)
- Trade count caption below P&L
- Background tint: accent-soft if profit, warn-soft if loss
- Weekend cells dimmed if no activity

### 5. App: Stats

Editorial header "The numbers." (Inter sans, weight 600 — not serif).

**Order:**
1. Header + date range tabs (1W / 1M active / 3M / YTD / All)
2. Hairline rule
3. Four-up hero stats: Net P&L (accent, 48px), Win rate, Profit factor, Expectancy — all Inter sans tabular-nums
4. Hairline rule
5. Four secondary stat cards (boxed): Avg win, Avg loss, Largest win, Max drawdown
6. Hairline rule
7. Two-up: bar chart by day of week + win-rate ring with caption
8. Hairline rule
9. Setups ranked — clean list with progress bars per setup

---

## Components / Patterns to extract

When rebuilding, factor these out into reusable components:

| Component | Used in | Notes |
|---|---|---|
| `Sparkline` | Dashboard, Stats, landing features | SVG path with gradient fill area + stroke line. Props: `data`, `width`, `height`, `color` |
| `Ring` | Stats | SVG circle with stroke-dasharray. Props: `pct`, `size`, `color`, `track` |
| `Avatar` | Sidebar | Initials on amber gradient circle |
| `EditorialHeader` | Every app screen | Eyebrow + title + optional sub. Title is Inter 30px sans |
| `StatBlock` | Dashboard, Stats hero | Eyebrow label + large tabular number + optional sub |
| `StatCard` | Lower dashboard, secondary stats | Boxed version of StatBlock with border + radius 12–14px |
| `Sidebar` | App shell | Persistent. Active item italic Fraunces with 2px accent left-border |
| `OutcomeToggle` | Log | Two big tinted buttons with arrow + label |
| `RatingPills` | Log | A/B/C/D with label captions |
| `DayTile` | Calendar | Day number + sans P&L + tint by sign |

---

## Interactions

- **Sidebar nav**: Active item gets accent left-border + Fraunces italic. Click to navigate
- **Outcome toggle (Log)**: Click to switch — active state changes border + bg tint to accent (win) or warn (loss)
- **Rating pills (Log)**: Same selection pattern
- **Date range tabs (Stats)**: Active gets accent color + weight 500
- **Tweaks panel** (review only): The current files include a dark/light mode toggle — in the real app, persist this via Supabase user preferences or `localStorage`, and apply via a `data-theme="dark"` attribute on `<html>`
- **FAQ items**: Currently rendered open. In production, make them collapsible (accordion) — the `+` rotates to `×` on open

---

## State / data shape (suggested)

If Supabase tables don't exist yet, this is a starting schema:

```sql
firms (id, name, slug, logo_url)
accounts (id, user_id, firm_id, account_size, status, max_drawdown, created_at)
  status: 'eval' | 'funded' | 'breached'
trades (id, account_id, symbol, direction, entry_price, exit_price, quantity, entry_time, exit_time, pnl, setup_notes, rating, screenshot_url)
  rating: 'A' | 'B' | 'C' | 'D'
fees (id, account_id, type, amount, paid_at)
  type: 'eval' | 'reset' | 'monthly'
payouts (id, account_id, amount, paid_at)
```

Aggregates (P&L, win rate, drawdown remaining, etc.) should be computed from these via Supabase views or RPC functions, not stored.

---

## Files in this bundle

- `TradeEdge Landing.html` — landing page (single self-contained file)
- `TradeEdge Hi-Fi.html` — app shell using a design-canvas review wrapper
- `tradeedge-hifi.jsx` — all app screen components (Dashboard, Log, Calendar, Stats, Sidebar, primitives)
- `design-canvas.jsx`, `tweaks-panel.jsx` — review-only helpers (do NOT ship these)

---

## What to tell Claude Code

Open Claude Code in your repo and say something like:

> Read `design_handoff_tradeedge/README.md`. Look at the existing codebase to understand my framework, styling system, and Supabase setup. Then rebuild the landing page first, route by route, matching the design tokens and type scale exactly. Use the HTML files as reference for layout but write idiomatic [Next.js / Astro / etc.] components that fit my codebase.
>
> Once landing is done, scaffold the app shell with Supabase auth, then port the Dashboard screen first.

If the repo is empty, tell Claude Code to scaffold a Next.js 14 project with Tailwind, set up Supabase auth, and configure deployment to Cloudflare Pages — then rebuild from the design files.
