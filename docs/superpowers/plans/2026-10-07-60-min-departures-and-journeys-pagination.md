# 60-Minute Departures & Journey Planner with Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide at least 60 minutes of transit departures and journey planner connections with on-demand "Later" and "Earlier" pagination controls.

**Architecture:** Extend `fetchDepartures` with optional `timeStr` and `dateStr` parameters. In `LiveDepartures`, batch fetch departures until a >= 60-minute window is covered, remove the hardcoded 10-item limit, and add a "Later departures" on-demand button. In `JourneyPlanner`, batch fetch trips until >= 60 minutes of travel is covered, and add "Earlier" and "Later" pagination buttons.

**Tech Stack:** React 18, Vite, Vitest, Lucide Icons, Framer Motion.

## Global Constraints
- Preserve existing autocomplete, favorites, and transport badges styling.
- Prevent duplicate departures or journeys when concatenating batches.
- Ensure all automated unit tests in `npm test -- --run` pass.
- Demonstrate locally on `http://localhost:5174/` before deploying to Vercel.

---

### Task 1: Enhance `fetchDepartures` API to Support Time and Date Parameters (TDD)

**Files:**
- Modify: `src/services/api.js:37-40`
- Modify: `src/services/api.test.js`

**Interfaces:**
- Produces: `fetchDepartures(stationId: string, timeStr?: string, dateStr?: string): Promise<any>`

- [ ] **Step 1: Write failing test in `src/services/api.test.js`**
Add test asserting that `fetchDepartures` passes `&time=` and `&date=` when provided:
```javascript
  it('calls departureBoard with time and date parameters when provided', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ DepartureBoard: { Departure: [] } }),
    });

    await fetchDepartures('8600626', '19:30', '2026-10-07');
    expect(fetch).toHaveBeenCalledWith('./api/departureBoard?id=8600626&time=19:30&date=07.10.26&format=json');
  });
```

- [ ] **Step 2: Run test to verify failure**
Run: `npm test -- --run src/services/api.test.js`
Expected: FAIL

- [ ] **Step 3: Update `fetchDepartures` implementation in `src/services/api.js`**
```javascript
export async function fetchDepartures(stationId, timeStr, dateStr) {
    let url = `/departureBoard?id=${stationId}`;
    if (timeStr) {
        url += `&time=${timeStr}`;
    }
    if (dateStr) {
        const [yyyy, mm, dd] = dateStr.split('-');
        url += `&date=${dd}.${mm}.${yyyy.slice(2)}`;
    }
    return fetchJson(url);
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- --run src/services/api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat(api): support time and date query params in fetchDepartures"
```

---

### Task 2: Live Departures 60-Minute Auto-Window & On-Demand Pagination

**Files:**
- Modify: `src/components/LiveDepartures.jsx`
- Modify: `src/components/FormStyles.css`

**Interfaces:**
- Consumes: `fetchDepartures(stationId, timeStr)`
- Produces: Live Departures displaying full 60-minute window without 10-item cap, plus "Later departures (+30m)" button

- [ ] **Step 1: Update `LiveDepartures.jsx` to load 60-minute window and support later pagination**
1. Add time window calculation helper (parse `HH:MM` to minutes from start of day, handle midnight rollover).
2. On initial search or auto-load: fetch first batch. If time span < 60 minutes, fetch up to 3 subsequent batches using the latest departure time. Deduplicate items.
3. Remove `departures.slice(0, 10)` so all departures in the 60-minute window are displayed.
4. Add state `loadingMore: boolean` and function `loadMoreDepartures()` that queries departures starting from the latest departure time and appends them.
5. Add a pagination footer:
   - Window range: e.g. `Departures from 18:55 to 19:55 (28 departures)`
   - Button: `Load Later Departures (+30 min)`

- [ ] **Step 2: Add styles in `src/components/FormStyles.css`**
Add styles for `.pagination-bar`, `.pagination-info`, and `.pagination-btn`.

- [ ] **Step 3: Verify with tests and build**
Run: `npm test -- --run`
Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/components/LiveDepartures.jsx src/components/FormStyles.css
git commit -m "feat(departures): span at least 60 minutes with later departures pagination"
```

---

### Task 3: Journey Planner 60-Minute Travel Window & Earlier/Later Pagination

**Files:**
- Modify: `src/components/JourneyPlanner.jsx`

**Interfaces:**
- Consumes: `fetchJourney(fromLoc, toLoc, dateStr, timeStr)`
- Produces: Journey Planner showing >= 60 minutes of trips with "Earlier" and "Later" pagination buttons

- [ ] **Step 1: Update `JourneyPlanner.jsx` to batch fetch trips to cover >= 60 minutes**
1. Helper to extract departure time of a trip (`trip.Leg[0]?.Origin?.time || trip.Leg?.Origin?.time`).
2. On search: fetch initial trips. If trips span < 60 minutes from departure time, fetch subsequent batches (using last trip's departure time). Deduplicate trips.
3. Add `loadLaterJourneys()` and `loadEarlierJourneys()` handlers with `loadingMore` indicator.
4. Render pagination controls:
   - "Earlier journeys (-30m)" at top of journey list.
   - "Later journeys (+30m)" at bottom of journey list.
   - Summary badge of connection time window covered.

- [ ] **Step 2: Verify with tests and build**
Run: `npm test -- --run`
Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/components/JourneyPlanner.jsx
git commit -m "feat(journey): span at least 60 minutes of travel with earlier and later pagination"
```

---

### Task 4: Local Verification and Delivery

**Files:**
- Browser preview on `http://localhost:5174/`

- [ ] **Step 1: Verify Live Departures on local dev server**
Test with København H: verify departures span >= 60 mins and "Load Later Departures" appends later departures.
- [ ] **Step 2: Verify Journey Planner on local dev server**
Test search: verify connections span >= 60 mins and "Earlier" / "Later" pagination works smoothly.
- [ ] **Step 3: Final review and readiness for Vercel deployment**
