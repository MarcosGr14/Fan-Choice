# DESIGN SYSTEM SPECIFICATION — K-POP / J-POP RANKINGS LEAGUE

> **Status:** APPROVED DESIGN SYSTEM  
> **Aesthetic Philosophy:** Dark Obsidian Luxury, Arena High-Stakes Competition, Zero-Slop Precision.

---

## 1. Color Palette (60-30-10 Rule)

### 60% Canvas / Dark Foundations:
- `bg-neutral-950` (`#0a0a0a`): Primary page canvas.
- `bg-neutral-900` (`#171717`): Structural card surfaces and table headers.
- `border-neutral-800` (`#262626`): Hairline boundary dividers (`1px solid`).

### 30% Structural Elements & Hierarchy:
- `text-neutral-100` (`#f5f5f5`): Primary headlines, artist names, ranks.
- `text-neutral-400` (`#a3a3a3`): Body prose, table cell headers, secondary labels.
- `text-neutral-500` (`#737373`): Micro-metadata, timestamps, separators.
- `bg-neutral-800/40`: Hover rows, subtle tab backing, input borders.

### 10% High-Intent Accent Budget:
- **Emerald Accent (Verified Spotify / Streaming Velocity):**
  - Text: `text-emerald-400` (`#34d399`)
  - Border / Ring: `border-emerald-500/40`
  - Subtle glow / wash: `bg-emerald-500/10`
- **Violet Accent (League Championship / Votes):**
  - Text: `text-violet-400` (`#a78bfa`)
  - Border / Ring: `border-violet-500/40`
  - Subtle glow: `bg-violet-500/10`
- **Gold / Amber (Podium #1 & Absolute Champion):**
  - Text: `text-amber-400` (`#fbbf24`)
  - Subtle backing: `bg-amber-500/10`

---

## 2. Typography Rules

- **Display & Headings:** `Plus Jakarta Sans`, font weights 600 (SemiBold) and 700 (Bold). Tight tracking (`tracking-tight`).
- **Body & Prose:** `Plus Jakarta Sans`, weight 400 (Regular) and 500 (Medium).
- **Scores, Counts & Timers:** `JetBrains Mono` with `tabular-nums font-mono`. Guarantees clean vertical alignment and zero layout jitter.
- **Headline Balance:** Always apply `text-wrap: balance` to hero titles.
- **Zero Orphan Words:** Maintain disciplined max-width containers.

---

## 3. Zero-Pill & Metadata Discipline

- **No Static Pill Enclosures:** Metadata (scene, category, scrobble count, date) is rendered as clean unboxed text separated by subtle typographic dots (`·` or `/`).
- **Functional Segmented Controls:** Filter tabs (e.g. `Male Ladder | Female Ladder | All`) use clean segmented button containers, never floating pill badges.
- **No Mechanical Code Prefixes:** Never render headers like `// 01_MALE_LADDER` or `>_ SYSTEM_ONLINE`. Use natural editorial headers: `Male Top 10 Ladder`.
- **No Decorative Pulsing Dots:** Only use animated indicators when an actual active real-time stream or countdown timer is live.

---

## 4. Layout Architecture & Breakpoints

- **Desktop Baseline:** 1440px wide with max-width container (`max-w-7xl` ~1280px).
- **Podium Visual Layout (Top 3):**
  - #1 Center-promoted elevation with subtle amber aura and largest artist photo.
  - #2 Flanked left, slightly stepped down.
  - #3 Flanked right, slightly stepped down.
- **Rank 4 through 10 Grid / Table:**
  - Compact row height ($48\text{px}$–$56\text{px}$), clean hairline borders, right-aligned numbers for points and streams.
- **Mobile Responsive Layout:**
  - Responsive stacking with full touch target heights ($\ge 44\text{px}$).
  - Smooth horizontal scrolling for wide data tables if needed, with sticky rank and artist columns.

---

## 5. Resilient Imagery & Fallback Protocol

Every artist thumbnail incorporates a guaranteed fallback:
```tsx
<div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700">
  <img 
    src={artist.imageUrl} 
    alt={artist.displayName} 
    referrerPolicy="no-referrer"
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
    className="w-full h-full object-cover"
  />
  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-neutral-400 select-none -z-0">
    {artist.displayName.slice(0, 2).toUpperCase()}
  </div>
</div>
```
