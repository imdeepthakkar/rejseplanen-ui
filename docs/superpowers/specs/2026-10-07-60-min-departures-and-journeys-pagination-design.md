# Design Specification: 60-Minute Departures & Journey Planner with On-Demand Pagination

## 1. Overview
Currently, Rejseplanen's raw API responses and frontend slicing limit displayed results:
- `LiveDepartures` was hardcoded to `departures.slice(0, 10)`, and busy central stations return only 5–10 minutes of departures in a single call.
- `JourneyPlanner` returns only 3 trips per call, covering ~15–20 minutes.

This design expands both views to cover **at least 60 minutes** of travel from the requested time, while introducing **on-demand pagination** ("Later departures / journeys" and "Earlier journeys") so users can browse forward and backward across arbitrary time windows.

---

## 2. API Service Layer Updates (`src/services/api.js`)

### `fetchDepartures(stationId, timeStr, dateStr)`
- Update signature to accept optional `timeStr` (format `HH:MM`) and `dateStr` (format `YYYY-MM-DD` converted to `DD.MM.YY`).
- When provided, append `&time=${timeStr}` and `&date=${dateStr}` to the query URL.

---

## 3. Live Departures 60-Minute Window & Pagination

### Initial Load
1. Remove `departures.slice(0, 10)` hardcoded limitation.
2. In `loadDepartures(query, startTime = null)`:
   - Make initial departure board request.
   - If returned departures span less than 60 minutes from the first departure (or current time), automatically query next batch(es) using the latest departure's `time`.
   - Batch queries loop up to 4 iterations or until `(latestDepartureMinutes - earliestDepartureMinutes) >= 60`.
   - Deduplicate departures using a composite key: `${d.date || ''}_${d.time}_${d.name}_${d.direction}_${d.track || d.rtTrack || ''}`.
   - Sort departures chronologically.

### On-Demand Pagination Controls
- At the bottom of the departures list, render a modern pagination bar:
  - Header: `Showing departures: HH:MM – HH:MM (N departures)`
  - Action button: `Load Later Departures (+30 min)`
  - When clicked: loads the next batch of departures starting from the last departure's time, appends to the list, and updates the window indicator.
  - Loading state: shows inline button spinner/text `Loading more departures...` without disrupting already visible items.

---

## 4. Journey Planner 60-Minute Window & Pagination

### Initial Search
1. In `handleSubmit(e)`:
   - Fetch the first set of trips for the specified date and time.
   - If trips span less than 60 minutes (measured between first trip departure time and last trip departure time), fetch consecutive trip batches (up to 3 batches or until >= 60 mins).
   - Deduplicate trips by composite key: `${trip.Leg[0].Origin.date}_${trip.Leg[0].Origin.time}_${trip.Leg[0].Destination.name}`.

### On-Demand Pagination Controls
- At the bottom of the journeys list:
  - Action button: `Later Journeys (+30 min)`: fetches trips departing after the last trip's departure time and appends them.
- At the top of the journeys list:
  - Action button: `Earlier Journeys (-30 min)`: fetches trips departing before the earliest trip's departure time and prepends them.
- Header badge showing active coverage: `Showing connections from HH:MM to HH:MM`.

---

## 5. Verification Plan
- **Unit Tests**:
  - Test `fetchDepartures` with and without `timeStr` in `src/services/api.test.js`.
  - Test time span calculation and deduplication helper functions.
- **Local Dev Server Verification**:
  - Test Live Departures with a busy hub (e.g. `København H`): verify departures span at least 60 minutes.
  - Test "Load Later Departures" button: verify subsequent departures load and append.
  - Test Journey Planner (e.g. `København H` to `Nørreport`): verify trips span 60 minutes.
  - Test "Later Journeys" and "Earlier Journeys" pagination buttons.
