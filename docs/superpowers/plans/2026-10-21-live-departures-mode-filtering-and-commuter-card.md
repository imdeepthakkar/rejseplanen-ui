# Live Departures Mode Filtering & Commuter Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide full transport mode filtering (All, Bus, S-Tog, Metro, RE, Letbane) with authentic Danish transit colors and icons, and eliminate destination text truncation on mobile using an adaptive 2-row commuter card layout with live minute countdowns.

**Architecture:** 
1. A pure classification engine (`src/utils/transportModes.js`) maps Rejseplanen API departure objects (`type`, `name`) to 6 distinct transit modes.
2. A countdown utility (`src/utils/countdownHelpers.js`) computes real-time minutes remaining (`Nu`, `3 min`, etc.).
3. A mobile-optimized horizontal chip bar (`src/components/ModeFilterBar.jsx`) renders mode filters with specific colors/icons (Yellow for Bus, Red for S-tog, Green for Letbane, M for Metro, RE embedded in train for Regional).
4. `src/components/LiveDepartures.jsx` integrates the filter state and transforms each departure item into an adaptive 2-row card with full-width directions (`→ Destination`), zero truncation, and live countdowns.

**Tech Stack:** React 18, Vite, Framer Motion, Lucide React, Vitest, Playwright.

## Global Constraints

- Bus filter chip must use **Movia Yellow** (`#FFC627` / `#F59E0B`) with dark text (`#111827`).
- S-Tog filter chip must use **DSB S-tog Red** (`#C8102E`) with white text.
- Letbane filter chip must use **Letbane Green** (`#10B981` / `#059669`) with white text.
- Metro must have an **M** inside its transit icon.
- Regional train (RE) must have **RE** inside/beside its train icon.
- Direction must use an arrow (`→`) instead of `"towards"`.
- Direction text must NEVER be truncated with ellipsis; it must wrap onto row 2 across the full card width.
- Live minute countdown (`Nu`, `X min`, `Xt Ym`) must be computed from `rtTime || time` against device clock.

---

### Task 1: Mode Classification Engine & Unit Tests

**Files:**
- Create: `src/utils/transportModes.js`
- Test: `src/utils/transportModes.test.js`

**Interfaces:**
- Produces:
  - `MODE_KEYS`: `['ALL', 'BUS', 'S_TOG', 'METRO', 'RE', 'LETBANE']`
  - `classifyDeparture(d)`: returns `MODE_KEYS` value
  - `TRANSPORT_MODES`: object mapping mode key to metadata `{ id, label, color, background, iconType }`

- [ ] **Step 1: Write the failing unit tests for mode classification**

Create `src/utils/transportModes.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { classifyDeparture, MODE_KEYS, TRANSPORT_MODES } from './transportModes';

describe('transportModes', () => {
  it('defines the 6 required modes with correct colors and metadata', () => {
    expect(MODE_KEYS).toEqual(['ALL', 'BUS', 'S_TOG', 'METRO', 'RE', 'LETBANE']);
    expect(TRANSPORT_MODES.BUS.background).toBe('#FFC627');
    expect(TRANSPORT_MODES.BUS.color).toBe('#111827');
    expect(TRANSPORT_MODES.S_TOG.background).toBe('#C8102E');
    expect(TRANSPORT_MODES.LETBANE.background).toBe('#10B981');
    expect(TRANSPORT_MODES.METRO.iconType).toBe('metro-m');
    expect(TRANSPORT_MODES.RE.iconType).toBe('train-re');
  });

  it('classifies S-tog correctly', () => {
    expect(classifyDeparture({ type: 'S', name: 'A' })).toBe('S_TOG');
    expect(classifyDeparture({ type: 'S', name: 'B' })).toBe('S_TOG');
  });

  it('classifies Metro correctly', () => {
    expect(classifyDeparture({ type: 'M', name: 'Metro M1' })).toBe('METRO');
    expect(classifyDeparture({ type: 'M', name: 'M3' })).toBe('METRO');
    expect(classifyDeparture({ type: 'TOG', name: 'M4' })).toBe('METRO');
  });

  it('classifies Buses correctly', () => {
    expect(classifyDeparture({ type: 'BUS', name: '5C' })).toBe('BUS');
    expect(classifyDeparture({ type: 'EXB', name: '150S' })).toBe('BUS');
    expect(classifyDeparture({ type: 'BUS', name: 'Havnebus 991' })).toBe('BUS');
  });

  it('classifies Letbane correctly', () => {
    expect(classifyDeparture({ type: 'LET', name: 'L2' })).toBe('LETBANE');
    expect(classifyDeparture({ type: 'TB', name: 'Letbane L1' })).toBe('LETBANE');
    expect(classifyDeparture({ type: 'TOG', name: 'Aarhus Letbane' })).toBe('LETBANE');
  });

  it('classifies Regional and Intercity trains correctly', () => {
    expect(classifyDeparture({ type: 'REG', name: 'Re 1234' })).toBe('RE');
    expect(classifyDeparture({ type: 'IC', name: 'IC 871' })).toBe('RE');
    expect(classifyDeparture({ type: 'ICL', name: 'ICL 23' })).toBe('RE');
    expect(classifyDeparture({ type: 'TOG', name: 'ICE 10934' })).toBe('RE');
    expect(classifyDeparture({ type: 'TOG', name: 'Öresundståg 1123' })).toBe('RE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/transportModes.test.js`
Expected: FAIL with "Cannot find module './transportModes'"

- [ ] **Step 3: Implement minimal code in `src/utils/transportModes.js`**

Create `src/utils/transportModes.js`:
```javascript
export const MODE_KEYS = ['ALL', 'BUS', 'S_TOG', 'METRO', 'RE', 'LETBANE'];

export const TRANSPORT_MODES = {
  ALL: {
    id: 'ALL',
    label: 'All',
    background: '#475569',
    color: '#FFFFFF',
    iconType: 'all',
  },
  BUS: {
    id: 'BUS',
    label: 'Bus',
    background: '#FFC627',
    color: '#111827',
    iconType: 'bus',
  },
  S_TOG: {
    id: 'S_TOG',
    label: 'S-Tog',
    background: '#C8102E',
    color: '#FFFFFF',
    iconType: 's-tog',
  },
  METRO: {
    id: 'METRO',
    label: 'Metro',
    background: '#E51937',
    color: '#FFFFFF',
    iconType: 'metro-m',
  },
  RE: {
    id: 'RE',
    label: 'RE',
    background: '#001D4A',
    color: '#FFFFFF',
    iconType: 'train-re',
  },
  LETBANE: {
    id: 'LETBANE',
    label: 'LetBane',
    background: '#10B981',
    color: '#FFFFFF',
    iconType: 'letbane',
  },
};

export function classifyDeparture(departure) {
  if (!departure) return 'RE';
  const type = (departure.type || '').toUpperCase();
  const name = (departure.name || '').trim();
  const lowerName = name.toLowerCase();

  // 1. S-tog
  if (type === 'S') {
    return 'S_TOG';
  }

  // 2. Metro
  if (type === 'M' || lowerName.includes('metro') || /^M[1-4]\b/i.test(name)) {
    return 'METRO';
  }

  // 3. Letbane (Light Rail / Tram)
  if (
    type === 'LET' || 
    type === 'TB' || 
    lowerName.includes('letbane') || 
    lowerName.includes('tram') ||
    lowerName.includes('light rail')
  ) {
    return 'LETBANE';
  }

  // 4. Bus / Havnebus
  if (
    type === 'BUS' || 
    type === 'EXB' || 
    type === 'NB' || 
    type === 'TBUS' ||
    lowerName.includes('bus') || 
    lowerName.includes('havnebus')
  ) {
    return 'BUS';
  }

  // 5. Regional / Intercity / International trains
  return 'RE';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/transportModes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/transportModes.js src/utils/transportModes.test.js
git commit -m "feat: add transport modes classification and metadata"
```

---

### Task 2: Live Minute Countdown Helper & Unit Tests

**Files:**
- Create: `src/utils/countdownHelpers.js`
- Test: `src/utils/countdownHelpers.test.js`

**Interfaces:**
- Produces:
  - `getLiveCountdown(timeStr, rtTimeStr, now = new Date())`: returns `{ text, minutes, isDelayed, isImminent }`
    - `text`: `"Nu"`, `"1 min"`, `"5 min"`, `"1t 15m"`
    - `minutes`: numeric diff from now
    - `isDelayed`: boolean (true if rtTime is after time)
    - `isImminent`: boolean (true if <= 2 min)

- [ ] **Step 1: Write the failing unit tests for countdown calculation**

Create `src/utils/countdownHelpers.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { getLiveCountdown } from './countdownHelpers';

describe('countdownHelpers', () => {
  it('returns "Nu" when departure is in less than 1 minute or in the past', () => {
    const now = new Date(2026, 9, 21, 18, 30, 0); // 18:30
    const res = getLiveCountdown('18:30', null, now);
    expect(res.text).toBe('Nu');
    expect(res.minutes).toBe(0);
    expect(res.isImminent).toBe(true);

    const pastRes = getLiveCountdown('18:28', null, now);
    expect(pastRes.text).toBe('Nu');
    expect(pastRes.minutes).toBeLessThanOrEqual(0);
  });

  it('calculates remaining minutes correctly when on time', () => {
    const now = new Date(2026, 9, 21, 18, 30, 0);
    const res = getLiveCountdown('18:35', null, now);
    expect(res.text).toBe('5 min');
    expect(res.minutes).toBe(5);
    expect(res.isDelayed).toBe(false);
  });

  it('uses real-time time (rtTime) to compute countdown and flags delay', () => {
    const now = new Date(2026, 9, 21, 18, 30, 0);
    const res = getLiveCountdown('18:32', '18:36', now);
    expect(res.text).toBe('6 min');
    expect(res.minutes).toBe(6);
    expect(res.isDelayed).toBe(true);
  });

  it('formats hours and minutes when over 60 minutes', () => {
    const now = new Date(2026, 9, 21, 18, 0, 0);
    const res = getLiveCountdown('19:25', null, now);
    expect(res.text).toBe('1t 25m');
    expect(res.minutes).toBe(85);
  });

  it('handles midnight boundary gracefully', () => {
    const now = new Date(2026, 9, 21, 23, 55, 0); // 23:55
    const res = getLiveCountdown('00:05', null, now); // 00:05 next day
    expect(res.text).toBe('10 min');
    expect(res.minutes).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/countdownHelpers.test.js`
Expected: FAIL with "Cannot find module './countdownHelpers'"

- [ ] **Step 3: Implement `src/utils/countdownHelpers.js`**

Create `src/utils/countdownHelpers.js`:
```javascript
export function getLiveCountdown(timeStr, rtTimeStr, now = new Date()) {
  if (!timeStr) {
    return { text: '--', minutes: 0, isDelayed: false, isImminent: false };
  }

  const effectiveTime = rtTimeStr || timeStr;
  const isDelayed = Boolean(rtTimeStr && rtTimeStr !== timeStr);

  const [depHours, depMinutes] = effectiveTime.split(':').map(Number);
  const nowHours = now.getHours();
  const nowMinutes = now.getMinutes();

  const depTotal = depHours * 60 + depMinutes;
  const nowTotal = nowHours * 60 + nowMinutes;

  let diff = depTotal - nowTotal;

  // Handle midnight roll-over (e.g., now is 23:55, departure is 00:10)
  if (diff < -720) {
    diff += 1440;
  } else if (diff > 720) {
    diff -= 1440;
  }

  const isImminent = diff <= 2;

  let text;
  if (diff <= 0) {
    text = 'Nu';
  } else if (diff === 1) {
    text = '1 min';
  } else if (diff < 60) {
    text = `${diff} min`;
  } else {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    text = `${hours}t ${mins}m`;
  }

  return {
    text,
    minutes: Math.max(0, diff),
    isDelayed,
    isImminent,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/countdownHelpers.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/countdownHelpers.js src/utils/countdownHelpers.test.js
git commit -m "feat: add live minute countdown helper with delay and midnight handling"
```

---

### Task 3: Mode Filter Bar Component & Custom Transit Icons

**Files:**
- Create: `src/components/ModeFilterBar.jsx`
- Create: `src/components/ModeFilterBar.css`

**Interfaces:**
- Props:
  - `selectedMode`: string (`'ALL'`, `'BUS'`, `'S_TOG'`, `'METRO'`, `'RE'`, `'LETBANE'`)
  - `onSelectMode`: function `(modeKey) => void`
  - `counts`: object `{ ALL: number, BUS: number, S_TOG: number, METRO: number, RE: number, LETBANE: number }`

- [ ] **Step 1: Write `src/components/ModeFilterBar.jsx` with authentic icons**

Create `src/components/ModeFilterBar.jsx`:
```jsx
import React from 'react';
import { Bus, Train, Tram, Layers } from 'lucide-react';
import { MODE_KEYS, TRANSPORT_MODES } from '../utils/transportModes';
import './ModeFilterBar.css';

function renderModeIcon(iconType) {
  switch (iconType) {
    case 'all':
      return <Layers size={14} className="mode-icon" />;
    case 'bus':
      return <Bus size={14} className="mode-icon" />;
    case 's-tog':
      return (
        <span className="s-tog-icon-badge" aria-hidden="true">
          S
        </span>
      );
    case 'metro-m':
      return (
        <span className="metro-m-icon" aria-hidden="true">
          M
        </span>
      );
    case 'train-re':
      return (
        <span className="re-train-icon-badge" aria-hidden="true">
          <Train size={12} />
          <span className="re-text">RE</span>
        </span>
      );
    case 'letbane':
      return <Tram size={14} className="mode-icon" />;
    default:
      return null;
  }
}

export default function ModeFilterBar({ selectedMode, onSelectMode, counts = {} }) {
  return (
    <div className="mode-filter-container" role="toolbar" aria-label="Filter departures by transport mode">
      <div className="mode-filter-scroll">
        {MODE_KEYS.map((key) => {
          const config = TRANSPORT_MODES[key];
          const isSelected = selectedMode === key;
          const count = counts[key] ?? 0;

          return (
            <button
              key={key}
              type="button"
              className={`mode-filter-chip ${isSelected ? 'active' : ''} mode-${key.toLowerCase()}`}
              onClick={() => onSelectMode(key)}
              aria-pressed={isSelected}
              title={`Filter by ${config.label} (${count})`}
            >
              <span className="mode-filter-icon-wrap" style={{ background: config.background, color: config.color }}>
                {renderModeIcon(config.iconType)}
              </span>
              <span className="mode-filter-label">{config.label}</span>
              <span className="mode-filter-count">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ModeFilterBar.css` with mobile styling**

Create `src/components/ModeFilterBar.css`:
```css
.mode-filter-container {
  margin: 10px 0 16px;
  width: 100%;
}

.mode-filter-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px 8px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.mode-filter-scroll::-webkit-scrollbar {
  display: none;
}

.mode-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 8px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 20px;
  color: var(--ink);
  font-family: var(--ui);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.mode-filter-chip:hover {
  background: #f8fafc;
  transform: translateY(-1px);
}

.mode-filter-chip:active {
  transform: scale(0.97);
}

.mode-filter-chip.active {
  background: #000000;
  color: #ffffff;
  border-color: #000000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.mode-filter-icon-wrap {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

/* Iconic Metro [M] */
.metro-m-icon {
  font-family: var(--disp);
  font-weight: 900;
  font-size: 13px;
  line-height: 1;
  letter-spacing: -0.05em;
}

/* S-Tog [S] */
.s-tog-icon-badge {
  font-family: var(--disp);
  font-weight: 900;
  font-size: 13px;
  line-height: 1;
}

/* RE with train */
.re-train-icon-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  font-weight: 800;
}

.re-text {
  font-family: var(--disp);
  letter-spacing: -0.05em;
}

.mode-filter-count {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.7;
  padding: 1px 5px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 10px;
}

.mode-filter-chip.active .mode-filter-count {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  opacity: 0.9;
}
```

- [ ] **Step 3: Verify build with `npm run build`**

Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ModeFilterBar.jsx src/components/ModeFilterBar.css
git commit -m "feat: add ModeFilterBar with Danish transit icons and color system"
```

---

### Task 4: Adaptive 2-Row Commuter Card in `LiveDepartures.jsx`

**Files:**
- Modify: `src/components/LiveDepartures.jsx`
- Modify: `src/utils/transportStyles.js`
- Modify: `src/components/FormStyles.css`

**Interfaces:**
- Consumes:
  - `classifyDeparture`, `TRANSPORT_MODES` from `../utils/transportModes`
  - `getLiveCountdown` from `../utils/countdownHelpers`
  - `ModeFilterBar` from `./ModeFilterBar`

- [ ] **Step 1: Update `src/utils/transportStyles.js` to support Letbane Green and clean badge formatting**

Update `src/utils/transportStyles.js`:
Ensure Letbane returns `#10B981` (green) and standardizes clean badge text without unnecessary `"Bus "` or `"Metro "` prefixes if desired.

- [ ] **Step 2: Update `LiveDepartures.jsx` to integrate mode filtering, countdown, and 2-row layout**

In `src/components/LiveDepartures.jsx`:
1. Add `selectedMode` state (`'ALL'`).
2. Add live timer `useEffect` triggering a re-render every 30 seconds so countdowns update automatically.
3. Compute counts per mode across `departures`:
   ```javascript
   const counts = useMemo(() => {
     const acc = { ALL: departures?.length || 0, BUS: 0, S_TOG: 0, METRO: 0, RE: 0, LETBANE: 0 };
     if (!departures) return acc;
     for (const d of departures) {
       const m = classifyDeparture(d);
       if (acc[m] !== undefined) acc[m]++;
     }
     return acc;
   }, [departures]);
   ```
4. Filter departures:
   ```javascript
   const filteredDepartures = useMemo(() => {
     if (!departures) return [];
     if (selectedMode === 'ALL') return departures;
     return departures.filter(d => classifyDeparture(d) === selectedMode);
   }, [departures, selectedMode]);
   ```
5. Render `ModeFilterBar` above the departures list.
6. Render each departure card in 2 rows:
   - **Row 1:**
     - Countdown badge (`countdown.text`) with live styling (green for on time/imminent, amber for delay).
     - Scheduled clock time (`d.time`).
     - Line badge (`d.name`) with mode styling.
     - Platform (`Spor ${d.rtTrack || d.track}`).
   - **Row 2:**
     - Direction: `→ ${d.direction}` in bold, full card width, wrapping naturally with no ellipsis cutoff.
     - Delay/Cancellation line: `(Expected: ${d.rtTime} · +${diff} min)` or `(Cancelled)` in red.
7. Provide empty state when `filteredDepartures.length === 0`:
   - *"No {mode} departures found in next 30 min"*
   - Button to trigger `handleLoadLater` to fetch later departures.

- [ ] **Step 3: Update `src/components/FormStyles.css` for card styling**

Add styles for:
- `.departure-card`: 2-row flex/column container with smooth background, border-radius 10px, padding 10px 14px.
- `.dep-row-top`: display flex, align-items center, justify-content space-between.
- `.dep-row-bottom`: margin-top 6px, display flex, flex-direction column, gap 2px.
- `.dep-direction`: font-size 15px, font-weight 700, color var(--ink), word-break break-word, line-height 1.3.
- `.dep-arrow`: font-size 16px, margin-right 4px, color var(--sub).
- `.countdown-pill`: padding 2px 7px, border-radius 6px, font-size 12px, font-weight 800.

- [ ] **Step 4: Run unit tests and build**

Run: `npm test && npm run build`
Expected: All tests pass, production bundle compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveDepartures.jsx src/utils/transportStyles.js src/components/FormStyles.css
git commit -m "feat: implement 2-row commuter card layout and live minute countdown"
```

---

### Task 5: Mobile Android Emulation Verification

**Files:**
- Test: `scratch_playwright_test.mjs` (or `tests/e2e/departures.spec.mjs`)

- [ ] **Step 1: Update Playwright test script to verify all filters and 0 truncations**

Update `scratch_playwright_test.mjs`:
1. Launch Android Pixel 7 emulation.
2. Navigate to `http://localhost:5174/` and load Nørreport departures.
3. Assert all 6 mode filters (`All`, `Bus`, `S-Tog`, `Metro`, `RE`, `LetBane`) are visible with their respective icons/colors.
4. Click `Bus` filter -> Verify only buses are displayed.
5. Click `S-Tog` filter -> Verify only S-trains are displayed.
6. Click `All` filter.
7. Inspect all rendered destination elements (`.dep-direction`):
   - Assert `scrollWidth <= clientWidth` for all cards (i.e., **0 truncated destinations**).
   - Assert no text contains `"towards "` and starts with arrow `→`.
8. Take screenshot `departures_android_verified.png`.

- [ ] **Step 2: Run the Playwright verification script**

Run: `node scratch_playwright_test.mjs`
Expected: Output confirms all filters work, 0 truncations detected across all departures.

- [ ] **Step 3: Commit**

```bash
git add scratch_playwright_test.mjs
git commit -m "test: verify mobile departures mode filtering and zero truncation via Playwright"
```
