# Live Departures First & Default Home Departures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prioritize Live Departures as the primary view (first tab, default active tab on open) and auto-load transit departures for the user's saved Home address/station upon app launch.

**Architecture:** Update `getDefaultTab` fallback in `storage.js` to `'departures'`, swap the tab item order in `Tabs.jsx`, and equip `LiveDepartures.jsx` with lifecycle logic to read saved favorites on mount and automatically trigger departures for `home` (or display a setup callout if Home is not yet configured).

**Tech Stack:** React 18, Vite, Vitest, Lucide Icons, Framer Motion.

## Global Constraints
- Do not break existing tab pinning (star pin icon) or manual station searches.
- Preserve mobile responsiveness and existing UI styling patterns.
- Ensure all automated tests in `npm test -- --run` pass.
- Demonstrate locally on dev server before deploying to Vercel.

---

### Task 1: Update Default Tab in Storage Service (TDD)

**Files:**
- Modify: `src/services/storage.js:9-16`
- Modify: `src/services/storage.test.js:24-26`

**Interfaces:**
- Consumes: `DEFAULT_TAB_KEY` from `storage.js`
- Produces: `getDefaultTab(): 'departures' | 'journey'`

- [ ] **Step 1: Write the failing test**
Update `src/services/storage.test.js`:
```javascript
  it('returns departures as default tab when unset', () => {
    expect(getDefaultTab()).toBe('departures');
  });
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- --run src/services/storage.test.js`
Expected: FAIL with `AssertionError: expected 'journey' to be 'departures'`

- [ ] **Step 3: Update `getDefaultTab` in `src/services/storage.js`**
Update `getDefaultTab`:
```javascript
export function getDefaultTab() {
  try {
    const tab = localStorage.getItem(DEFAULT_TAB_KEY);
    return tab === 'journey' ? 'journey' : 'departures';
  } catch (err) {
    return 'departures';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**
Run: `npm test -- --run src/services/storage.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/services/storage.js src/services/storage.test.js
git commit -m "feat(storage): make departures the default fallback tab"
```

---

### Task 2: Swap Tab Item Order in Navigation UI

**Files:**
- Modify: `src/components/Tabs.jsx:17-64`

**Interfaces:**
- Consumes: `activeTab`, `onTabChange`
- Produces: Visual tab bar with Live Departures first (left) and Journey Planner second (right)

- [ ] **Step 1: Swap tab items in `Tabs.jsx`**
In `src/components/Tabs.jsx`, place the `departures` tab item block before the `journey` tab item block:
```jsx
    <div className="tabs-container" role="tablist">
      <div 
        className={`tab-item ${activeTab === 'departures' ? 'active' : ''}`}
        onClick={() => onTabChange('departures')}
        role="tab"
        aria-selected={activeTab === 'departures'}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabChange('departures'); }}
      >
        <span className="tab-label">Live Departures</span>
        <button
          type="button"
          className={`tab-default-pin ${defaultTab === 'departures' ? 'is-default' : ''}`}
          onClick={(e) => handleToggleDefault(e, 'departures')}
          title={defaultTab === 'departures' ? 'Default launch tab' : 'Set as default launch tab'}
          aria-label={defaultTab === 'departures' ? 'Default launch tab' : 'Set as default launch tab'}
        >
          <Star 
            size={14} 
            fill={defaultTab === 'departures' ? '#F59E0B' : 'none'} 
            color={defaultTab === 'departures' ? '#F59E0B' : 'currentColor'} 
          />
        </button>
      </div>

      <div 
        className={`tab-item ${activeTab === 'journey' ? 'active' : ''}`}
        onClick={() => onTabChange('journey')}
        role="tab"
        aria-selected={activeTab === 'journey'}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabChange('journey'); }}
      >
        <span className="tab-label">Journey Planner</span>
        <button
          type="button"
          className={`tab-default-pin ${defaultTab === 'journey' ? 'is-default' : ''}`}
          onClick={(e) => handleToggleDefault(e, 'journey')}
          title={defaultTab === 'journey' ? 'Default launch tab' : 'Set as default launch tab'}
          aria-label={defaultTab === 'journey' ? 'Default launch tab' : 'Set as default launch tab'}
        >
          <Star 
            size={14} 
            fill={defaultTab === 'journey' ? '#F59E0B' : 'none'} 
            color={defaultTab === 'journey' ? '#F59E0B' : 'currentColor'} 
          />
        </button>
      </div>
    </div>
```

- [ ] **Step 2: Run all tests to verify no regressions**
Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/components/Tabs.jsx
git commit -m "feat(tabs): display live departures as the first tab"
```

---

### Task 3: Auto-Load Home Address Departures & Setup Prompt in LiveDepartures

**Files:**
- Modify: `src/components/LiveDepartures.jsx`
- Modify: `src/components/LiveDepartures.css` (or `FormStyles.css` / scoped styling)

**Interfaces:**
- Consumes: `getFavorites()` from `src/services/storage.js`, `EditFavoriteModal` from `src/components/EditFavoriteModal`
- Produces: Auto-loaded departures for home on mount, or home setup prompt if unset

- [ ] **Step 1: Update `LiveDepartures.jsx` with mount auto-load and unset prompt**
Add `useEffect` on mount:
1. Fetch favorites with `getFavorites()`.
2. Find `homeFav = favs.find(f => f.id === 'home')`.
3. If `homeFav?.station?.trim()` exists: set `station` to `homeFav.station` and call `loadDepartures(homeFav.station)`.
4. If not configured: set state `isHomeConfigured = false` and offer a quick setup banner with `Set Home Address` button that opens `EditFavoriteModal`.
5. When `EditFavoriteModal` updates favorites, if Home was just configured, immediately load its departures.

- [ ] **Step 2: Add styles for the Home setup banner**
Add clean, attractive styling in `FormStyles.css` matching the modern macOS design aesthetic.

- [ ] **Step 3: Run unit and build tests**
Run: `npm test -- --run`
Run: `npm run build`
Expected: PASS with 0 build errors.

- [ ] **Step 4: Commit**
```bash
git add src/components/LiveDepartures.jsx src/components/FormStyles.css
git commit -m "feat(departures): auto-load home departures on mount with setup banner if unset"
```

---

### Task 4: Local Verification on Dev Server

**Files:**
- Verify in browser

- [ ] **Step 1: Start local dev server**
Run: `npm run dev`
Verify server URL (e.g. `http://localhost:5173`).

- [ ] **Step 2: Verify tab ordering and default view**
- Confirm Live Departures is the first tab on the left and active by default.
- Confirm Journey Planner is the second tab on the right.

- [ ] **Step 3: Verify Home departure auto-loading**
- When Home is unset: Confirm the "Set Home Address" prompt is clearly visible.
- Click "Set Home Address", configure a station (e.g., `København H` or an address).
- Refresh the page: Confirm Live Departures immediately loads departures for Home without clicking any buttons.

- [ ] **Step 4: Commit and finalize**
```bash
git status
```
