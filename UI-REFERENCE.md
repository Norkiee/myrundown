# UI Reference

This file contains the working prototype built as a React artifact in Claude.ai. 
Use this as the definitive design reference for all UI components.

## Design Decisions Already Made

- Dark mode only (#080808 background)
- Switzer font throughout
- Max-width 640px centered content
- Minimal/bookmarking app aesthetic (not generic SaaS)
- Inverted CTA buttons (light text on dark bg → dark text on light bg for primary actions)
- Table-row list view for queue/all/read (favicon initial + title + domain + date)
- Card view for today's picks with embedded digest sections
- Hover-reveal actions on table rows
- Pill-shaped topic tags and score badges
- Dashed (—) list items in takeaways, not bullets
- "Must Read" verdict = green, "Digest Enough" = blue
- Subtle fade-up animation on cards, fade-in on rows
- Decorative input bar below header (non-functional, cosmetic)

## Component Breakdown

### Header
- Left: SVG icon (rounded rect with 3 horizontal lines) + "Daily Reads" text
- Right: "Updated Xm ago" muted text + gear icon button + "Fetch Articles" primary CTA

### Decorative Input Bar
- Rounded border container
- "+" icon left, tagline text center, "⌘ F" shortcut badge right
- All in muted colors, not interactive

### Tab Navigation
- Flush with content, bottom-bordered
- Tabs: "Today's Reads" | "Queue (N)" | "All (N)" | "Done (N)"
- Active tab: light text + bottom border
- "Summarize Articles" button right-aligned in tab bar (only on Today view)

### Article Card (Today view)
- Background surface with subtle border
- Meta row: source (bold) + topic (pill badge) + score (colored pill, right-aligned)
- Title: 21px, semibold, linked
- Summary: 14px muted paragraph
- Digest section (when loaded):
  - Nested darker surface
  - "KEY TAKEAWAYS" label left + verdict pill right
  - Dashed list items
  - "Why it matters" italic text below separator
- Footer: "Read Full Article →" primary button + "Done Reading" ghost text

### Article Row (List views)
- Flex row: favicon circle (first letter of source) | title link + domain text | date right-aligned
- Hover reveals: checkmark button + X button
- Read articles at 35% opacity

### Settings Panel
- Slides in below header
- "YOUR INTERESTS" uppercase label
- Hint text
- Textarea (dark bg, bordered)
- Save (green) + Cancel (ghost) + Clear All (red, right-aligned)

### Footer
- Topic chips in a wrapping flex row
- Small, muted, pill-shaped

### Status Bar
- Animated blue dot + message text
- Error variant: red-tinted, with dismiss X

## Color Reference

```
Background:     #080808
Surface:        #0e0e0e  
Surface dark:   #090909  (nested surfaces like digests)
Border:         #191919
Border hover:   #2a2a2a

Text primary:   #ddd8d0
Text secondary: #b5b0a8
Text muted:     #444
Text faint:     #333

Score high:     #48a870 on #0a1f12
Score mid:      #a09040 on #1f1c0a
Score low:      #a05050 on #1f0a0a

Verdict Must:   #48a870 on #0a1f12
Verdict Enough: #6080b0 on #0e0e20

Topic pill:     #4a5570 on #0e0e18
Source text:    #666
CTA button:     #ddd8d0 bg, #080808 text
```
