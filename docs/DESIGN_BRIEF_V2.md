# Design Brief v2: MCC Homepage — Control Tower

> Synthesized from /shape discovery interview + 8 meeting transcripts + .impeccable.md context

---

## 1. Feature Summary

A single-page control tower for 4 executives (CEO, VP Product, Head of Engineering, VP Media Buying) who check it multiple times daily for 30-second scans. It answers "what needs my attention?" above the fold, then provides financial health, engineering health, and operational status below. The information hierarchy is: **Problems → Money → People → Infrastructure**. Users want maximum density — they read all numbers, but only ACT on red/green signals.

**The core failure to fix**: Information hierarchy is wrong. The most important things aren't the most visible. The current design treats all sections equally, but the first fold should be a "CEO screen" that can be shown in a meeting with no scrolling.

---

## 2. Primary User Action

**Spot what's wrong, then drill down to understand WHY.**

Not "browse metrics." Not "explore data." The user opens the page with one question: "is anything on fire?" If yes → click the fire → see the breakdown → decide. If no → close tab, go back to work. Under 60 seconds.

---

## 3. Design Direction

**Calm authority with surgical precision.** Reference: Vibrant Wellness (noomoagency.com) — but adapted for data density.

From `.impeccable.md`:
- Frosted glass cards (allowed — this is our visual identity)
- Satoshi typeface (distinctive, not AI-default)
- OKLCH colors, indigo-tinted neutrals
- Color ONLY for status. Everything else is quiet.

**Key aesthetic tension**: Users want DENSITY (they read all numbers) but the design must still feel CALM (not a chaotic trading terminal). Resolution: use **typographic hierarchy** and **spatial rhythm** to make dense content scannable. Large numbers for critical metrics, small for context. Generous spacing between sections, tight within sections.

**Anti-goals**:
- NOT a generic SaaS dashboard with identical card grids
- NOT a dark mode trading terminal with neon accents
- NOT so minimal that information is hidden behind clicks
- NOT anxiety-inducing — problems should feel actionable, not overwhelming

---

## 4. Layout Strategy

### The First Fold (above the fold — NO scrolling)

This is the **CEO screen**. It must work as a standalone presentation slide.

```
┌────────────────────────────────────────────────────────┐
│ HEADER: MCC + period selector + last updated + lang    │
│                                                        │
│ INSIGHT STRIP: The most critical thing happening now   │
│ "3 buyer groups losing money. Consider pausing DE."    │
│                                                        │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│ │PROFIT  │ │ROI     │ │STOP    │ │VELOCITY│          │
│ │$309K 🟢│ │10% 🟡  │ │3 🔴    │ │27% 🔴  │          │
│ │↑24%    │ │↓3%     │ │$33K/mo │ │avg 75% │          │
│ └────────┘ └────────┘ └────────┘ └────────┘          │
│                                                        │
│ The 4 most important numbers: 2 money + 2 operations   │
│ This is ALL you need to see in a meeting.              │
└────────────────────────────────────────────────────────┘
```

**Key decision**: Only **4 KPIs** above the fold, not 5 or 8. These are:
1. **Profit** (are we making money?)
2. **ROI** (how efficiently?)
3. **STOP Signals** (how many campaigns are burning?)
4. **Sprint Velocity** (is the team shipping?)

These 4 cover: Money (1,2) + Buying Problems (3) + Engineering (4). One number per concern.

### Below the Fold (scroll for detail)

Vertical sections, but NOT equal weight. Larger sections for problems and money, compact for engineering and infrastructure.

**Section A: Active Fires** (the drill-down target)
- Geo breakdown: which countries make/lose money
- STOP campaigns: which buyer groups to pause
- This is what the user drills into when they see red above

**Section B: Engineering Pulse**
- Sprint progress (2 thin bars)
- Top 3 bottleneck people (bars with names)
- Bug density (just the number, not a chart)
- Compact — takes 1/3 the space of Section A

**Section C: Problem Tracker**
- 6-10 problem chips in a row
- Just status: name + testing/investigating/resolved
- Click any → goes to /problems page

**Section D: Infrastructure**
- One line. Numbers only. No cards.

### Visual Hierarchy

| Element | Size | Weight | Purpose |
|---------|------|--------|---------|
| Insight text | 14px | Medium | Read first — the narrative |
| KPI values | 32px | Extra-bold | Scan second — the numbers |
| KPI labels | 10px | Semibold caps | Context for the numbers |
| Comparison text | 11px | Regular | Trend direction |
| Section headers | 11px | Semibold caps | Wayfinding |
| Geo/bottleneck rows | 13px | Medium | Detail rows |
| Problem chip names | 12px | Semibold | Status scan |
| Infrastructure strip | 13px | Regular | Glanceable context |

---

## 5. Key States

| State | First Fold Shows | Below Fold |
|-------|-----------------|------------|
| **All healthy** | 4 green KPIs. Insight: "✅ No critical issues." | Normal data, no red. |
| **Money problem** | ROI yellow/red. STOP count red. Insight: specific geo + suggested action. | Geo table highlights losers. |
| **Engineering problem** | Velocity red. Insight: "Sprint velocity dropped X%." | Bottleneck list shows overloaded people. |
| **Multiple fires** | Multiple red KPIs. Insight lists all fires prioritized by impact. | All sections show relevant red. |
| **Loading** | Skeleton matching exact layout. "Updating..." in header. | Skeletons per section. |
| **API error** | Show last-known values with "⚠ Keitaro unavailable · 45m old" | Per-section error notices. |
| **First visit** | Same page. No tutorial. Data speaks for itself. | — |

---

## 6. Interaction Model

**Glance → Spot → Click → Understand**

1. **Glance** (0-5 seconds): Read the 4 KPIs above the fold. Spot any red.
2. **Spot** (5-10 seconds): Read the insight text. Understand WHAT's wrong.
3. **Click** (10-15 seconds): Click the red KPI or the geo table row.
4. **Understand** (15-30 seconds): See the breakdown. Decide to act or note for meeting.

**Click targets**:
- KPI cards → expand inline to show breakdown (not navigate away)
- Geo rows → navigate to /buying with that geo focused
- Bottleneck names → navigate to /engineering with that person focused
- Problem chips → navigate to /problems with that problem expanded
- Infrastructure numbers → navigate to /processes

**Hover**:
- KPI cards: subtle lift + shadow
- Geo rows: background highlight
- Problem chips: border brighten

**No modals. No tooltips. No right-click menus.** Simple click-to-navigate or click-to-expand.

---

## 7. Content Requirements

### Insight Text (auto-generated, rule-based)

Template patterns:
- Fire: `"{count} buyer groups losing money (ROI < -30%). Consider pausing {geo_list}."`
- Warning: `"Sprint velocity at {pct}% — below {avg}% average. Review sprint scope."`
- Bottleneck: `"{person}: {count} tasks (was {prev}). Workload growing."`
- Positive: `"{count} buyer groups profitable — {profit} profit over {period}."`
- Recommendation: `"Consider {action}. Estimated impact: {amount}/month."`

### KPI Labels
- Short. "Profit" not "Total Profit". "ROI" not "Return on Investment".
- Always show comparison: "↑24% vs prev" or "avg 75%"

### Section Labels
- All caps, small, muted. "ACTIVE FIRES" not "Section 2: Financial Details"

### Problem Chip Status Text
- "testing" / "investigating" / "planned" / "42%" — lowercase, no "Status:"

---

## 8. Recommended References

For implementation with /impeccable:
- `reference/spatial-design.md` — for the first-fold layout and density management
- `reference/typography.md` — for the type scale that makes density readable
- `reference/motion-design.md` — for staggered entry animations
- `reference/interaction-design.md` — for the drill-down expand pattern
- `reference/color-and-contrast.md` — for OKLCH palette with indigo-tinted neutrals

---

## 9. Open Questions

1. **KPI expand behavior**: When clicking a KPI card, should it expand inline (pushing content down) or open a side panel? Inline is simpler. Side panel keeps the overview visible.
2. **Recommendation aggressiveness**: "Consider pausing" is soft. Should it escalate to "Recommend pausing" if the loss exceeds a threshold (e.g., >$50K/month)?
3. **Engineering on first fold**: Is Sprint Velocity the right 4th KPI? Or should it be "Blocked Items" or "Bug Density"? Velocity was chosen because it's the broadest indicator.
4. **Sparklines**: The impeccable skill says "don't use sparklines as decoration." We should ONLY show sparklines on the 4 first-fold KPIs where trend data exists and adds meaning. Not on everything.
