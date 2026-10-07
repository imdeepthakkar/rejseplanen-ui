# Design Specification: Live Departures First & Default Home Departures

## 1. Overview
This specification details the user-facing and technical changes to prioritize **Live Departures** as the primary view in Rejseplanen UI:
1. Swapping tabs in the navigation bar so **Live Departures** appears first (left) and **Journey Planner** appears second (right).
2. Setting **Live Departures** as the default landing view upon opening the app.
3. Automatically displaying live transit departures for the user's saved **Home** address or station upon app launch.
4. Providing an intuitive, integrated setup card when the Home address is not yet configured.

---

## 2. Tab Navigation & Default State

### Tab Reordering
- In [`src/components/Tabs.jsx`](file:///C:/Users/deept/AIProjects/rejseplanen-ui/src/components/Tabs.jsx):
  - Swap the order of `<div className="tab-item ...">` blocks so **Live Departures** is rendered first, followed by **Journey Planner**.
  - Retain accessibility semantics (`role="tab"`, `aria-selected`, `tabIndex`, and keyboard navigation).
  - Retain default launch tab pinning (the star icon) for each tab, allowing users to override their preferred tab at any time.

### Default App State
- In [`src/services/storage.js`](file:///C:/Users/deept/AIProjects/rejseplanen-ui/src/services/storage.js):
  - In `getDefaultTab()`, update the default fallback from `'journey'` to `'departures'` when no custom preference has been stored in `localStorage`.
- In [`src/services/storage.test.js`](file:///C:/Users/deept/AIProjects/rejseplanen-ui/src/services/storage.test.js):
  - Update unit tests to assert that `getDefaultTab()` returns `'departures'` when unconfigured.

---

## 3. Auto-Loading Home Departures in LiveDepartures

### Component Lifecycle (`LiveDepartures.jsx`)
- On initial mount (`useEffect`):
  - Retrieve favorites via `getFavorites()`.
  - Locate the home entry (`id === 'home'`).
  - **Case A: Home address/station is configured (`homeFav.station` is non-empty)**:
    - Set the input value `station` to `homeFav.station`.
    - Automatically invoke `loadDepartures(homeFav.station)` to fetch and render departures immediately.
  - **Case B: Home address is unset/empty (`!homeFav || !homeFav.station`)**:
    - Do not trigger departure queries.
    - Render a prominent, friendly callout banner below the search bar:
      - Icon and headline: `🏠 No Home address set`
      - Description: `Configure your home address or station to see live departures here whenever you open the app.`
      - Action button: `Set Home Address` which opens the `EditFavoriteModal`.
  - When a user saves or updates their Home address via the modal, the `LiveDepartures` view receives the update and triggers `loadDepartures` for the new address.

---

## 4. Error Handling & Edge Cases
- **Network / API Failures**: If the Home station or address fails to load departures (due to network failure or invalid station query), display standard error messaging with a retry button.
- **Switching Places**: Users can freely select any other favorite chips or enter a different station in the autocomplete field without clearing their default Home setting.
- **Default Tab Pin**: If the user explicitly changes the pinned default tab to "Journey Planner", the app honors that choice on subsequent visits.

---

## 5. Verification Plan
- **Automated Tests**:
  - Run `npm test -- --run` to ensure all existing storage and API unit tests pass, updating the `getDefaultTab` expectation.
- **Local Browser Verification**:
  - Launch local dev server via `npm run dev`.
  - Verify tab order: Live Departures on the left, Journey Planner on the right.
  - Test initial launch with unset Home: Verify the "Set Home Address" banner renders cleanly.
  - Test setting Home address (e.g., `København H` or an address like `Rådhuspladsen 1`): Verify live departures fetch and render automatically on launch.
