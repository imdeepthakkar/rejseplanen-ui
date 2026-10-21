# In-App User Feedback Feature Design

**Date:** 2026-10-21  
**Status:** Approved  
**Author:** Antigravity & User  

---

## 1. Overview & Goal

The goal of this feature is to allow users to submit feedback (suggestions, enhancements, or bug reports) directly from within the Rejseplanen web app and PWA. Submitted feedback is automatically converted into tracked GitHub Issues in the repository (`imdeepthakkar/rejseplanen-ui`), labeled appropriately, and enriched with automatic system diagnostics to simplify triaging and implementation.

---

## 2. User Experience & UI Design

### 2.1 Trigger Button
- **Placement:** Located in the macOS-styled window titlebar (`.mac-titlebar`) immediately to the left of the `Install` button.
- **Button Label:** `💬 Feedback`
- **Styling:** Compact pill-shaped glassmorphic button with subtle hover animation matching existing titlebar controls (`.mac-install-btn`).
- **Accessibility:** `aria-label="Send feedback or report an issue"`.

### 2.2 In-App Feedback Sheet (`FeedbackModal.jsx`)
Clicking the trigger button opens an in-app bottom sheet modal with smooth backdrop blur and `framer-motion` enter/exit animations:

1. **Header:**
   - Title: "Share Feedback"
   - Subtitle: "Bug reports, enhancements & ideas"
   - Close button (`✕`) at top right.

2. **Category Switcher (Chips):**
   - 🐛 **Bug Report** — applies label `bug`.
   - 💡 **Enhancement** — applies label `enhancement`.
   - ✨ **Suggestion** — applies label `suggestion`.

3. **Form Fields:**
   - **Summary (Title):** Single-line input (e.g. *"S-Tog delay badge slightly off-center on mobile"*). Required.
   - **Description:** Multi-line textarea (e.g. *"When checking Line B at Herlev, the delay timestamp appeared behind the track label."*). Required.
   - **Email (Optional):** Optional email address if the user desires follow-up updates.

4. **Auto-Collected System Diagnostics:**
   - Collapsible preview showing auto-collected details:
     - **Active View / Station:** e.g., `LiveDepartures (Herlev Bygade (Herlevgårdsvej))` or `JourneyPlanner`
     - **Platform & Browser:** OS, browser vendor & version
     - **Viewport & DPR:** e.g., `412 × 915 · 2.6x DPR`
     - **PWA Status:** Standalone vs Browser tab
     - **Timestamp:** ISO & local string

5. **Submit Action:**
   - Button text: **`Submit Feedback`** (clean, user-friendly, no "to GitHub").
   - Loading spinner state during transmission.

### 2.3 Confirmation / Success State
- Once created, the modal displays an animated green checkmark with:
  - "Feedback Logged!"
  - Badge with the generated GitHub Issue number: e.g. `GitHub Issue: #43 · bug`
  - "Done" button to dismiss, or auto-dismiss after 3 seconds.

---

## 3. Architecture & Data Flow

```
[User Form + Auto Diagnostics]
              │
              ▼
    [FeedbackModal.jsx]
              │
              ▼
   [src/services/feedbackService.js]
              │
              ▼ (POST /api/feedback)
[Vite Dev Middleware / Serverless Function (api/feedback.js)]
              │ (Securely attaches GITHUB_FEEDBACK_TOKEN)
              ▼ (POST https://api.github.com/repos/:owner/:repo/issues)
       [GitHub Issues API]
              │
              ▼
    Issue created with:
      - Title: "[Bug] S-Tog delay badge slightly off-center"
      - Labels: ["bug", "user-feedback"]
      - Formatted Markdown Body with Diagnostics
```

### 3.1 Security & Token Protection
- Client-side code **never** exposes the GitHub Personal Access Token.
- Submissions hit `/api/feedback`.
  - In local development, a Vite plugin / middleware handles `/api/feedback` using `process.env.GITHUB_FEEDBACK_TOKEN`.
  - In production (Vercel / Netlify / Cloudflare), a serverless function `api/feedback.js` handles requests with environment variables.

### 3.2 Offline & Resiliency Handling
- **Offline detection:** If `navigator.onLine` is false, feedback is queued in `localStorage` under `rejseplanen_offline_feedback` and submitted when network reconnects.
- **Missing Token Fallback:** If the backend proxy is unconfigured, the app falls back seamlessly to a 1-click pre-filled GitHub Issue URL so user feedback is never dropped.

---

## 4. Components & File Structure

1. **`src/components/FeedbackModal.jsx`**:
   - Manages category selection, input validation, diagnostics assembly, submission, and confirmation states.
2. **`src/components/FeedbackModal.css`**:
   - Modern glassmorphic styling, responsive layout, animations, and high-contrast accessible focus states.
3. **`src/services/feedbackService.js`**:
   - Gathers device diagnostics, formats GitHub markdown payloads, posts to `/api/feedback`, and handles offline queueing.
4. **`src/services/feedbackService.test.js`**:
   - Unit tests covering diagnostics gathering, payload formatting, input validation, and offline queueing.
5. **`api/feedback.js` & `vite.config.js`**:
   - Serverless handler and Vite dev server middleware to proxy issue creation to GitHub securely.
6. **`src/App.jsx`**:
   - Adds the `💬 Feedback` trigger button in the titlebar and renders `FeedbackModal`.

---

## 5. Verification Plan

1. **Unit Tests (`npm test`)**:
   - Verify `feedbackService.js` payload assembly, markdown body generation, and diagnostics format.
   - Verify offline queueing and recovery.
2. **Build Verification (`npm run build`)**:
   - Ensure clean bundle compilation with no lint, CSS, or syntax errors.
3. **End-to-End Test (Playwright)**:
   - Launch app on mobile emulation (Pixel 7).
   - Click `💬 Feedback` in the header.
   - Fill out a bug report and verify the form interactions.
   - Capture screenshot of open modal and submit action.
