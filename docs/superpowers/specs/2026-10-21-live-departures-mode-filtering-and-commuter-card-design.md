# Design Spec: Live Departures Mode Filtering & Commuter Card Layout

**Date:** 2026-10-21  
**Status:** Approved  
**Author:** Pair Programming (Antigravity & User)

---

## 1. Problem Statement & Background

When Copenhagen commuters use Rejseplanen on mobile devices (e.g. Android screen widths ~360–393px):
1. **Destination Truncation:**
   - Destination names are heavily clipped with ellipsis (`Bus 5C towards Københavns Luft...`, `Bus 150S towards Kokkedal St...`).
   - The word `"towards "` consumes ~50px of horizontal room.
   - Long train operators/numbers (e.g. `ICE 10934`, `Öresundståg 1123`, `Re 1234`) enlarge the badge, leaving less than 130px for the destination.
   - Track/platform badges on the right side and delays squeeze the middle column further.
2. **Absence of Transport Mode Filtering:**
   - High-frequency city bus lines (e.g. 5C every 3–4 minutes) flood interchange stations like Nørreport, burying S-trains (S-tog), Metro, and Regional trains (RE).
   - Commuters cannot quickly isolate their desired mode of transportation (Bus, S-tog, Metro, RE, Letbane).
3. **No Live Countdown:**
   - Departures show static wall-clock times (e.g. `18:35`) requiring mental calculation against real-time delays, whereas standard Danish transit displays (DSB, DOT, Metro) prioritize live countdowns (`Nu`, `3 min`, `12 min`).

---

## 2. Goals & Success Criteria

1. **Zero Destination Truncation:**
   - Replace `"towards "` with directional arrow `"→"`.
   - Adopt an adaptive 2-row card layout where the destination gets full card width on row 2, wrapping naturally without ellipsis cutoff.
2. **Dedicated Transit Mode Filter Bar:**
   - Horizontal pill filter bar: **All**, **Bus**, **S-Tog**, **Metro**, **RE (Train)**, **Letbane**.
   - Custom visual identity matching Danish public transit standards:
     - **Bus:** Movia Yellow (`#FFC627` / `#F59E0B`) with dark text & Bus icon.
     - **S-Tog:** Classic DSB S-tog Red (`#C8102E`) with white text & S-train icon.
     - **Metro:** Iconic **[M]** Metro symbol.
     - **RE (Train):** DSB Navy (`#001D4A` / `#1E3A8A`) with white text & Train icon containing an embedded **RE** badge.
     - **Letbane:** Letbane Green (`#10B981` / `#059669`) with white text & Tram icon.
   - Dynamic departure count per mode (e.g., `S-Tog (14)`).
3. **Live Minute Countdown:**
   - Displays real-time countdown badge (`Nu`, `3 min`, `45 min`) calculated from `rtTime || time` compared to current device clock.
   - Shows scheduled clock time alongside countdown.
4. **Platform / Delay Highlighting:**
   - Platform/track indicator (`Spor X` / `Trk X`) displayed on row 1 right side.
   - Real-time delay status (`Expected: 18:39 · +4 min`) or cancellation (`Aflyst / Cancelled`) displayed cleanly on the status line.

---

## 3. Architecture & Component Design

### 3.1 Mode Classification Engine (`src/utils/transportModes.js`)

A helper module to parse `d.type` and `d.name` from Rejseplanen API into standard modes:
- `MODE_KEYS`: `['ALL', 'BUS', 'S_TOG', 'METRO', 'RE', 'LETBANE']`
- **Classification Rules:**
  - `S_TOG`: `type === 'S'`
  - `METRO`: `type === 'M'` or `name.startsWith('M')`
  - `BUS`: `type === 'BUS'` or `type === 'EXB'` or `name.toLowerCase().includes('bus')` or `name.toLowerCase().includes('havnebus')`
  - `LETBANE`: `type === 'LET'` or `type === 'TB'` or `name.toLowerCase().includes('letbane')`
  - `RE`: `type === 'REG'` or `type === 'IC'` or `type === 'ICL'` or `type === 'TOG'` or `type === 'LYN'` or `type === 'SJ'` or `type === 'ICE'` or `type === 'EC'` or `name.toLowerCase().includes('öresund')` or fallback train types.

### 3.2 Transit Icon & Color Tokens

- **Bus:** Background `#FFC627`, Color `#111827`, Lucide `Bus` icon.
- **S-Tog:** Background `#C8102E`, Color `#FFFFFF`, Lucide `TrainFront` icon with red S-tog accent.
- **Metro:** Background `#E51937` (or line-specific M1/M2/M3/M4 colors), Color `#FFFFFF`, Custom Metro icon rendered with bold white **M**.
- **RE (Regional / Train):** Background `#001D4A`, Color `#FFFFFF`, Train icon with **RE** emblem badge.
- **Letbane:** Background `#10B981`, Color `#FFFFFF`, Lucide `Tram` icon in green.

### 3.3 Live Countdown Helper (`src/utils/countdownHelpers.js`)

- `getLiveCountdown(timeStr, rtTimeStr, currentDate = new Date())`:
  - Parses departure time into minutes from midnight (taking into account overnight transitions).
  - Calculates delta in minutes: `diff = departureMinutes - currentMinutes`.
  - Returns formatted string:
    - `diff <= 0`: `"Nu"`
    - `diff === 1`: `"1 min"`
    - `1 < diff < 60`: `"${diff} min"`
    - `diff >= 60`: `"${Math.floor(diff/60)}t ${diff%60}m"`

### 3.4 LiveDepartures Component Changes (`src/components/LiveDepartures.jsx`)

1. **State:**
   - `selectedMode`: defaults to `'ALL'`.
   - `currentTime`: ticks every 30 seconds to keep countdown badges fresh without refetching network.
2. **Filter Bar:**
   - Rendered below `AutocompleteInput` & `FavoriteChips`.
   - Horizontally scrollable row on mobile with zero scrollbar friction.
   - Shows mode pills with respective mode icons, colors, and live counts.
3. **Adaptive 2-Row Departure Card:**
   - **Row 1:**
     - Left: Countdown badge (e.g. `[ 3 min ]` in emerald green or amber if delayed) + Scheduled time (`18:35`).
     - Center: Mode / Line badge (`[ ICE 10934 ]`, `[ 5C ]`, `[ A ]`, `[ M3 ]`).
     - Right: Track badge (`Spor 4` or `Trk B`), styled with red warning if `rtTrack !== track`.
   - **Row 2:**
     - Direction container with arrow: `→ [Destination Name]`.
     - `white-space: normal`, `word-break: break-word`, flex-1 across full card width.
     - Real-time delay status: `(Expected: 18:39 · +4 min)` or `(Aflyst / Cancelled)`.
4. **Empty State:**
   - If selected mode has 0 departures in the current loaded window, display clear empty state:
     - *"Ingen [mode] afgange de næste 30 min"*
     - Action button to fetch next 30 min batch.

---

## 4. Testing & Verification Plan

1. **Unit Tests (Vitest):**
   - Test mode classification logic (`transportModes.test.js`) across edge-case API names (`ICE 10934`, `Bus 5C`, `S-tog A`, `Metro M3`, `Aarhus Letbane L2`, `Öresundståg`).
   - Test countdown helper (`countdownHelpers.test.js`) across midnight boundary, delays, and current time variations.
2. **Playwright Mobile Emulation Test:**
   - Run Android device emulation test (`Pixel 7`).
   - Search for `Nørreport St.`.
   - Verify all 6 mode filters are rendered with their respective icons and colors.
   - Switch through filters (`Bus`, `S-Tog`, `Metro`, `RE`, `Letbane`).
   - Verify destination text on all visible cards is not truncated (`scrollWidth === clientWidth` or text wraps to row 2 without ellipsis).
   - Capture screenshot and assert 0 truncated cards.
