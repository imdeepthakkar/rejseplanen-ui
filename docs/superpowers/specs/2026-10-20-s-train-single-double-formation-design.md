# Design Specification: S-Train Single vs Double Formation in Live Departures

## Context & Problem
In Copenhagen's S-train (S-tog) network, trains operate as either:
- **Single train (kort tog):** 1 train set (4 cars for Litra SE on Line F, or 8 cars for Litra SA).
- **Double train (langt tog):** 2 coupled train sets (e.g. 2 x 8 cars = 16 cars, or 2 x 4 cars).

Passengers waiting on platforms benefit greatly from knowing whether an approaching S-train is short or full-length, as short trains stop only in specific platform sectors (typically sectors A–B), while long trains extend across the full platform (typically sectors A–D).

Rejseplanen's `/departureBoard` endpoint does not provide a dedicated boolean flag (such as `isDouble`). Instead, train formation details appear in two ways:
1. Operational Notes and Messages in the departure item or its corresponding `/journeyDetail` response (e.g., `"Kører som kort tog"`, `"afsnit A-B"`, `"langt tog"`).
2. Composition/structure elements in `/journeyDetail` with coupled unit indicators.

When an S-train has no explicit notice in notes, messages, or journey details, the application must omit the badge rather than guessing.

---

## Requirements

1. **Detection Accuracy:**
   - Detect single train (*Kort tog*) from operational notes, messages, or sector tags (`"kort tog"`, `"kører som kort tog"`, `"enkelt togsæt"`, `"afsnit a-b"`, `"sektor a-b"`).
   - Detect double train (*Langt tog*) from operational notes, messages, or sector tags (`"langt tog"`, `"kører som langt tog"`, `"dobbelt togsæt"`, `"afsnit a-d"`, `"sektor a-d"`).
   - Detect coupled unit formations from `journeyDetail` structure when explicit train unit arrays or coupled sets are present.
   - Return `null` when no explicit indicator is found (no false positives, no guessing).

2. **Performance & Architecture:**
   - Fast initial render: Immediately evaluate any notes/messages already present in `/departureBoard`.
   - Background resolution: For S-train departures (`type === 'S'`), asynchronously fetch `/journeyDetail` via the local `/api/journeyDetail?...` proxy.
   - Deduplicate & cache requests by `JourneyDetailRef.ref` so multiple rows or rapid reloads do not flood the API.

3. **User Interface:**
   - Display a compact, non-intrusive badge on the departure row beside the line badge / destination for S-trains when a formation is detected.
   - Distinct styles:
     - Single train: Indigo/slate pill badge with train icon (e.g. `Kort tog (1 set)` or `Kort tog • A-B`).
     - Double train: Emerald/teal pill badge with train icon (e.g. `Langt tog (2 sets)` or `Langt tog • A-D`).
   - Preserve clean mobile responsive alignment for departure time, destination, delay info, and track numbers.

4. **Testing & Verification:**
   - Comprehensive unit tests covering detection regexes, case-insensitivity, sector extraction, structured composition parsing, and null/fallback safety.
   - Live testing in the local development server at `http://localhost:5174/`.

---

## Technical Design

### 1. `src/services/api.js`
Add `fetchJourneyDetail(refUrl)`:
```javascript
export async function fetchJourneyDetail(refUrl) {
    if (!refUrl) throw new Error('Missing journey detail reference URL');
    // Extract pathname and query from full URL or relative URL
    // e.g. "http://webapp.rejseplanen.dk/bin//rest.exe/journeyDetail?ref=...&format=json"
    const match = refUrl.match(/\/journeyDetail\?.+$/);
    const endpoint = match ? match[0] : `/journeyDetail?ref=${encodeURIComponent(refUrl)}`;
    const url = endpoint.includes('format=json') ? `./api${endpoint}` : `./api${endpoint}&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch journey detail');
    return res.json();
}
```

### 2. `src/utils/trainFormation.js`
Create helper functions for parsing:
```javascript
export function detectTrainFormation({ departure = {}, journeyDetail = null } = {}) {
    // 1. Gather all candidate text sources (departure notes, messages, journeyDetail notes & messages)
    const texts = [];

    // Departure item level
    if (departure.Notes) {
        if (typeof departure.Notes === 'string') texts.push(departure.Notes);
        else if (departure.Notes.Note) {
            const arr = Array.isArray(departure.Notes.Note) ? departure.Notes.Note : [departure.Notes.Note];
            arr.forEach(n => texts.push(n.value || n.text || ''));
        } else if (departure.Notes.text) {
            texts.push(departure.Notes.text);
        }
    }
    if (departure.Note) {
        const arr = Array.isArray(departure.Note) ? departure.Note : [departure.Note];
        arr.forEach(n => texts.push(n.text || n.value || ''));
    }

    // JourneyDetail level
    const jd = journeyDetail?.JourneyDetail || journeyDetail;
    if (jd?.Note) {
        const arr = Array.isArray(jd.Note) ? jd.Note : [jd.Note];
        arr.forEach(n => texts.push(n.text || n.value || ''));
    }
    if (jd?.MessageList?.Message) {
        const arr = Array.isArray(jd.MessageList.Message) ? jd.MessageList.Message : [jd.MessageList.Message];
        arr.forEach(m => {
            if (m.Header?.['$']) texts.push(m.Header['$']);
            else if (typeof m.Header === 'string') texts.push(m.Header);
            if (m.Text?.['$']) texts.push(m.Text['$']);
            else if (typeof m.Text === 'string') texts.push(m.Text);
        });
    }

    const combined = texts.join(' ').toLowerCase();

    // Check Single / Kort tog
    const isSingle = /(?:k[øo]rer\s+som\s+)?kort\s+tog/i.test(combined) ||
                     /enkelt\s+togs[æa]t/i.test(combined) ||
                     /(?:afsnit|sektor)\s+a[-–]b\b/i.test(combined);

    // Check Double / Langt tog
    const isDouble = /(?:k[øo]rer\s+som\s+)?langt\s+tog/i.test(combined) ||
                     /dobbelt\s+togs[æa]t/i.test(combined) ||
                     /(?:afsnit|sektor)\s+a[-–][cd]\b/i.test(combined);

    // Extract sector if explicitly present
    const sectorMatch = combined.match(/(?:afsnit|sektor)\s+([a-d][-–][a-d])/i);
    const sector = sectorMatch ? sectorMatch[1].toUpperCase() : null;

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

### 3. `src/components/LiveDepartures.jsx`
- Maintain `const [formations, setFormations] = useState({})` and a reference cache `formationCacheRef = useRef(new Map())`.
- When departures load, initiate background fetching for S-trains with `d.JourneyDetailRef?.ref`.
- Render the badge inside the departure item:
```jsx
{formation && (
  <span 
    className={`train-formation-badge ${formation.type}`}
    title={formation.label}
  >
    <TrainIcon size={12} />
    {formation.label}
  </span>
)}
```

---

## Verification Plan
1. **Vitest unit tests:** `npm test` verifying `detectTrainFormation` across single, double, sector cues, and negative cases.
2. **Local browser test:** Run on local dev server (`http://localhost:5174/`) and inspect live S-train departures from major hub stations (e.g., Nørreport St., København H).
3. **Build test:** `npm run build` succeeds cleanly with zero errors.
