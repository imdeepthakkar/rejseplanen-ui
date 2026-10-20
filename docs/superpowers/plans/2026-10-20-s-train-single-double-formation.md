# S-Train Single vs Double Formation in Live Departures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect whether Copenhagen S-trains are running as a single (kort tog — 1 train set, 4 or 8 cars) or double (langt tog — 2 coupled train sets) and display an intuitive compact badge on the Live Departures screen.

**Architecture:** A lightweight helper `fetchJourneyDetail(refUrl)` in `src/services/api.js` proxies journey detail calls. A standalone parser `detectTrainFormation({ departure, journeyDetail })` in `src/utils/trainFormation.js` evaluates operational notes, messages, sectors, and coupled formation cues, returning `{ type: 'single'|'double', label, shortLabel, sector }` or `null`. `LiveDepartures.jsx` caches results by journey ref and renders a compact pill badge beside S-train departures.

**Tech Stack:** React 18, Vite 5, Vitest, Lucide React (`Train` icon), CSS.

## Global Constraints
- Target platform: Node 20+, Modern Browsers, Windows environment.
- Only display single/double indicators when explicitly supported by API notes, messages, sectors, or journey detail formations (no guessing or false positives).
- All proxy calls must route through `./api` (or relative paths) to prevent CORS issues.
- Preserve all existing tests and features.

---

### Task 1: Add `fetchJourneyDetail` to `src/services/api.js`

**Files:**
- Modify: `src/services/api.js`
- Test: `src/services/api.test.js`

**Interfaces:**
- Produces: `fetchJourneyDetail(refUrl: string): Promise<any>`

- [ ] **Step 1: Write the failing test in `src/services/api.test.js`**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLocation, fetchJourney, fetchDepartures, fetchStopsNearby, fetchJourneyDetail } from './api';

// ... existing tests ...

describe('fetchJourneyDetail', () => {
    it('throws when refUrl is missing', async () => {
        await expect(fetchJourneyDetail()).rejects.toThrow('Missing journey detail reference URL');
    });

    it('fetches journey detail through local proxy with format=json', async () => {
        const mockResponse = { JourneyDetail: { Stop: [] } };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const refUrl = 'http://webapp.rejseplanen.dk/bin//rest.exe/journeyDetail?ref=123%2F456';
        const result = await fetchJourneyDetail(refUrl);

        expect(global.fetch).toHaveBeenCalledWith('./api/journeyDetail?ref=123%2F456&format=json');
        expect(result).toEqual(mockResponse);
    });

    it('handles refUrl that already has format=json', async () => {
        const mockResponse = { JourneyDetail: { Stop: [] } };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const refUrl = 'http://webapp.rejseplanen.dk/bin//rest.exe/journeyDetail?ref=123%2F456&format=json';
        const result = await fetchJourneyDetail(refUrl);

        expect(global.fetch).toHaveBeenCalledWith('./api/journeyDetail?ref=123%2F456&format=json');
        expect(result).toEqual(mockResponse);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/api.test.js`
Expected: FAIL with "fetchJourneyDetail is not a function"

- [ ] **Step 3: Implement `fetchJourneyDetail` in `src/services/api.js`**

```javascript
export async function fetchJourneyDetail(refUrl) {
    if (!refUrl) throw new Error('Missing journey detail reference URL');
    const match = refUrl.match(/\/journeyDetail\?.+$/);
    const endpoint = match ? match[0] : `/journeyDetail?ref=${encodeURIComponent(refUrl)}`;
    const url = endpoint.includes('format=json') ? `./api${endpoint}` : `./api${endpoint}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch journey detail');
    return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat(api): add fetchJourneyDetail helper with tests"
```

---

### Task 2: Implement `detectTrainFormation` Parser

**Files:**
- Create: `src/utils/trainFormation.js`
- Test: `src/utils/trainFormation.test.js`

**Interfaces:**
- Produces: `detectTrainFormation({ departure?: object, journeyDetail?: object }): { type: 'single'|'double', label: string, shortLabel: string, sector: string|null } | null`

- [ ] **Step 1: Write the failing tests in `src/utils/trainFormation.test.js`**

```javascript
import { describe, it, expect } from 'vitest';
import { detectTrainFormation } from './trainFormation';

describe('detectTrainFormation', () => {
    it('returns null when input is empty or null', () => {
        expect(detectTrainFormation()).toBeNull();
        expect(detectTrainFormation({})).toBeNull();
    });

    it('returns null when notes do not mention train formation', () => {
        const departure = {
            Notes: { text: 'Retning: Farum St.;Toget har lav indstigning' }
        };
        expect(detectTrainFormation({ departure })).toBeNull();
    });

    it('detects single train (kort tog) from departure Notes string', () => {
        const departure = {
            Notes: 'Kører som kort tog'
        };
        const result = detectTrainFormation({ departure });
        expect(result).toEqual({
            type: 'single',
            label: 'Kort tog (1 sæt)',
            shortLabel: 'Kort tog',
            sector: null
        });
    });

    it('detects single train with platform sectors (Afsnit A-B)', () => {
        const departure = {
            Notes: {
                Note: [
                    { value: 'Bemærk: Kører som kort tog, afsnit A-B' }
                ]
            }
        };
        const result = detectTrainFormation({ departure });
        expect(result).toEqual({
            type: 'single',
            label: 'Kort tog (1 sæt • A-B)',
            shortLabel: 'Kort tog',
            sector: 'A-B'
        });
    });

    it('detects double train (langt tog) from journeyDetail Notes', () => {
        const journeyDetail = {
            JourneyDetail: {
                Note: [
                    { text: 'Kører som langt tog i myldretiden' }
                ]
            }
        };
        const result = detectTrainFormation({ journeyDetail });
        expect(result).toEqual({
            type: 'double',
            label: 'Langt tog (2 sæt)',
            shortLabel: 'Langt tog',
            sector: null
        });
    });

    it('detects double train from platform sectors A-D', () => {
        const journeyDetail = {
            JourneyDetail: {
                Note: [
                    { text: 'Toget holder i sektor A-D' }
                ]
            }
        };
        const result = detectTrainFormation({ journeyDetail });
        expect(result).toEqual({
            type: 'double',
            label: 'Langt tog (2 sæt • A-D)',
            shortLabel: 'Langt tog',
            sector: 'A-D'
        });
    });

    it('detects single train from journeyDetail MessageList text', () => {
        const journeyDetail = {
            JourneyDetail: {
                MessageList: {
                    Message: [
                        { Header: { $: 'Toginformation' }, Text: { $: 'Enkelt togsæt på linje B' } }
                    ]
                }
            }
        };
        const result = detectTrainFormation({ journeyDetail });
        expect(result).toEqual({
            type: 'single',
            label: 'Kort tog (1 sæt)',
            shortLabel: 'Kort tog',
            sector: null
        });
    });

    it('detects double train from coupled train units structure in journeyDetail', () => {
        const journeyDetail = {
            JourneyDetail: {
                trainFormation: {
                    unit: [{ id: 'SA-01' }, { id: 'SA-02' }]
                }
            }
        };
        const result = detectTrainFormation({ journeyDetail });
        expect(result).toEqual({
            type: 'double',
            label: 'Langt tog (2 sæt)',
            shortLabel: 'Langt tog',
            sector: null
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/trainFormation.test.js`
Expected: FAIL with "Cannot find module './trainFormation'"

- [ ] **Step 3: Implement `detectTrainFormation` in `src/utils/trainFormation.js`**

```javascript
/**
 * Detects whether an S-train is running as a single (kort tog, 1 unit) or double (langt tog, 2 coupled units).
 * @param {object} params
 * @param {object} [params.departure]
 * @param {object} [params.journeyDetail]
 * @returns {{ type: 'single'|'double', label: string, shortLabel: string, sector: string|null } | null}
 */
export function detectTrainFormation({ departure = {}, journeyDetail = null } = {}) {
    const texts = [];

    // 1. Collect texts from departure object
    if (departure) {
        if (typeof departure.Notes === 'string') {
            texts.push(departure.Notes);
        } else if (departure.Notes?.Note) {
            const arr = Array.isArray(departure.Notes.Note) ? departure.Notes.Note : [departure.Notes.Note];
            arr.forEach(n => texts.push(n?.value || n?.text || ''));
        } else if (departure.Notes?.text) {
            texts.push(departure.Notes.text);
        }

        if (departure.Note) {
            const arr = Array.isArray(departure.Note) ? departure.Note : [departure.Note];
            arr.forEach(n => texts.push(n?.text || n?.value || ''));
        }
    }

    // 2. Collect texts from journeyDetail object
    const jd = journeyDetail?.JourneyDetail || journeyDetail;
    if (jd) {
        if (jd.Note) {
            const arr = Array.isArray(jd.Note) ? jd.Note : [jd.Note];
            arr.forEach(n => texts.push(n?.text || n?.value || ''));
        }

        if (jd.MessageList?.Message) {
            const arr = Array.isArray(jd.MessageList.Message) ? jd.MessageList.Message : [jd.MessageList.Message];
            arr.forEach(m => {
                if (m?.Header?.['$']) texts.push(m.Header['$']);
                else if (typeof m?.Header === 'string') texts.push(m.Header);

                if (m?.Text?.['$']) texts.push(m.Text['$']);
                else if (typeof m?.Text === 'string') texts.push(m.Text);
            });
        }

        // 3. Check for structured coupled unit formation in journeyDetail if present
        const formation = jd.trainFormation || jd.composition || jd.WagonFormation;
        if (formation) {
            const units = formation.unit || formation.Wagon || formation.units;
            if (Array.isArray(units)) {
                if (units.length >= 2) {
                    return {
                        type: 'double',
                        label: 'Langt tog (2 sæt)',
                        shortLabel: 'Langt tog',
                        sector: null
                    };
                } else if (units.length === 1) {
                    return {
                        type: 'single',
                        label: 'Kort tog (1 sæt)',
                        shortLabel: 'Kort tog',
                        sector: null
                    };
                }
            }
        }
    }

    const combined = texts.filter(Boolean).join(' ').toLowerCase();
    if (!combined) return null;

    // Matching single train (kort tog)
    const isSingle = /(?:k[øo]rer\s+som\s+)?kort\s+tog/i.test(combined) ||
                     /enkelt\s+togs[æa]t/i.test(combined) ||
                     /(?:afsnit|sektor)\s+a[-–]b\b/i.test(combined);

    // Matching double train (langt tog)
    const isDouble = /(?:k[øo]rer\s+som\s+)?langt\s+tog/i.test(combined) ||
                     /dobbelt\s+togs[æa]t/i.test(combined) ||
                     /(?:afsnit|sektor)\s+a[-–][cd]\b/i.test(combined);

    // Extract sector if explicitly mentioned
    const sectorMatch = combined.match(/(?:afsnit|sektor)\s+([a-d][-–][a-d])/i);
    const sector = sectorMatch ? sectorMatch[1].toUpperCase().replace('–', '-') : null;

    if (isSingle && !isDouble) {
        return {
            type: 'single',
            label: sector ? `Kort tog (1 sæt • ${sector})` : 'Kort tog (1 sæt)',
            shortLabel: 'Kort tog',
            sector
        };
    }

    if (isDouble && !isSingle) {
        return {
            type: 'double',
            label: sector ? `Langt tog (2 sæt • ${sector})` : 'Langt tog (2 sæt)',
            shortLabel: 'Langt tog',
            sector
        };
    }

    return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/trainFormation.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/trainFormation.js src/utils/trainFormation.test.js
git commit -m "feat(formation): implement detectTrainFormation parser with tests"
```

---

### Task 3: Integrate Train Formation Badge into `LiveDepartures.jsx` and CSS

**Files:**
- Modify: `src/components/LiveDepartures.jsx`
- Modify: `src/components/FormStyles.css`

**Interfaces:**
- Consumes: `fetchJourneyDetail` from `src/services/api`
- Consumes: `detectTrainFormation` from `src/utils/trainFormation`

- [ ] **Step 1: Add train formation badge styles to `src/components/FormStyles.css`**

Add styles:
```css
.train-formation-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 9999px;
  white-space: nowrap;
  line-height: 1.3;
}

.train-formation-badge.single {
  background-color: #EEF2FF;
  color: #4338CA;
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.train-formation-badge.double {
  background-color: #ECFDF5;
  color: #065F46;
  border: 1px solid rgba(16, 185, 129, 0.25);
}
```

- [ ] **Step 2: Update `LiveDepartures.jsx` to load and display formations**

Import `fetchJourneyDetail` and `detectTrainFormation`, plus `Train` from `lucide-react`:
- Manage a `formations` state dictionary and ref cache.
- In `useEffect` watching `departures`:
  - Immediately evaluate top-level notes on each departure.
  - For S-trains (`d.type === 'S'`) having `d.JourneyDetailRef?.ref`: if not already cached, fetch journey detail in background, call `detectTrainFormation`, and update the state.
- Render the badge in the departure row:
```jsx
{formation && (
  <span 
    className={`train-formation-badge ${formation.type}`}
    title={formation.label}
  >
    <Train size={12} />
    {formation.label}
  </span>
)}
```

- [ ] **Step 3: Run full vitest suite**

Run: `npm test`
Expected: PASS (all tests pass)

- [ ] **Step 4: Commit**

```bash
git add src/components/LiveDepartures.jsx src/components/FormStyles.css
git commit -m "feat(departures): display S-train single and double formation badges"
```

---

### Task 4: Local Verification and Build Verification

**Files:**
- N/A (Verification)

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Vite build succeeds with zero errors.

- [ ] **Step 3: Verify local dev server in browser**

Test searching "Nørreport St." or "København H" at `http://localhost:5174/` and verify S-train departures display cleanly without formatting regressions.

- [ ] **Step 4: Final commit and push check**

Confirm git status is clean and ready.
