# In-App User Feedback Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an integrated in-app feedback modal that lets users submit Bug Reports, Enhancements, and Suggestions directly into GitHub Issues with automatic system diagnostics, offline support, and zero token exposure.

**Architecture:** Client-side React modal (`FeedbackModal.jsx`) captures user inputs and device diagnostics, sending them via `src/services/feedbackService.js` to a `/api/feedback` endpoint. The endpoint (Vite dev server middleware locally, `api/feedback.js` serverless function in production) securely attaches the GitHub token and creates a labeled issue on GitHub.

**Tech Stack:** React, Framer Motion, Vanilla CSS, Vite, Vitest, Playwright.

## Global Constraints

- Header button must be placed in `.mac-titlebar` next to the `Install` button.
- Submit button copy MUST be "Submit Feedback" (do not include "to GitHub").
- Client code must never expose `GITHUB_FEEDBACK_TOKEN`.
- Categories must be: Bug Report (`bug`), Enhancement (`enhancement`), Suggestion (`suggestion`).
- Must include automatic system diagnostics (view, station, viewport, OS/browser, PWA mode).
- Offline fallback: queue submissions in `localStorage` when offline.
- TDD required: tests written and failing before production code.

---

### Task 1: Feedback Service & Diagnostics Engine

**Files:**
- Create: `src/services/feedbackService.js`
- Test: `src/services/feedbackService.test.js`

**Interfaces:**
- Produces:
  - `collectDiagnostics(context?: object): object`
  - `formatIssueBody(feedback: object, diagnostics: object): string`
  - `buildFeedbackPayload(feedback: object, context?: object): object`
  - `submitFeedback(feedback: object, context?: object): Promise<object>`
  - `queueOfflineFeedback(payload: object): void`
  - `getQueuedFeedback(): Array<object>`
  - `clearQueuedFeedback(): void`

- [ ] **Step 1: Write the failing unit tests for feedbackService**

Create `src/services/feedbackService.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  collectDiagnostics,
  formatIssueBody,
  buildFeedbackPayload,
  queueOfflineFeedback,
  getQueuedFeedback,
  clearQueuedFeedback,
  submitFeedback
} from './feedbackService.js';

describe('feedbackService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('collects diagnostics accurately including viewport and context', () => {
    const diag = collectDiagnostics({ activeTab: 'departures', station: 'Herlev St.' });
    expect(diag).toHaveProperty('userAgent');
    expect(diag).toHaveProperty('viewport');
    expect(diag).toHaveProperty('timestamp');
    expect(diag.activeTab).toBe('departures');
    expect(diag.station).toBe('Herlev St.');
  });

  it('formats issue markdown body with user details and diagnostics', () => {
    const feedback = {
      type: 'bug',
      summary: 'Delay badge clipping',
      description: 'Timestamp is clipped behind the track pill',
      email: 'test@example.com'
    };
    const diagnostics = {
      activeTab: 'departures',
      station: 'Herlev St.',
      viewport: '412x915',
      isStandalone: false,
      timestamp: '2026-10-21T20:00:00Z'
    };

    const body = formatIssueBody(feedback, diagnostics);
    expect(body).toContain('### User Feedback');
    expect(body).toContain('**Type:** Bug Report');
    expect(body).toContain('**Contact:** test@example.com');
    expect(body).toContain('Timestamp is clipped behind the track pill');
    expect(body).toContain('#### System Diagnostics');
    expect(body).toContain('Herlev St.');
    expect(body).toContain('412x915');
  });

  it('builds feedback payload with correct labels and formatted title', () => {
    const feedback = {
      type: 'enhancement',
      summary: 'Add dark mode toggle',
      description: 'Would love dark mode at night'
    };
    const payload = buildFeedbackPayload(feedback, { activeTab: 'journey' });

    expect(payload.title).toBe('[Enhancement] Add dark mode toggle');
    expect(payload.labels).toEqual(['enhancement', 'user-feedback']);
    expect(payload.body).toContain('Would love dark mode at night');
  });

  it('queues, retrieves, and clears offline feedback items in localStorage', () => {
    expect(getQueuedFeedback()).toEqual([]);

    const item = { title: 'Offline bug', body: 'details' };
    queueOfflineFeedback(item);

    const queued = getQueuedFeedback();
    expect(queued.length).toBe(1);
    expect(queued[0].title).toBe('Offline bug');

    clearQueuedFeedback();
    expect(getQueuedFeedback()).toEqual([]);
  });

  it('submits feedback to /api/feedback and returns issue data', async () => {
    const mockIssue = { issueNumber: 42, url: 'https://github.com/imdeepthakkar/rejseplanen-ui/issues/42' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockIssue
    });

    const result = await submitFeedback({
      type: 'suggestion',
      summary: 'New route alerts',
      description: 'Alert me on delay'
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }));
    expect(result).toEqual(mockIssue);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/services/feedbackService.test.js -- --run`  
Expected: FAIL with "Cannot find module './feedbackService.js'"

- [ ] **Step 3: Write minimal implementation in `src/services/feedbackService.js`**

Create `src/services/feedbackService.js`:

```javascript
const QUEUE_KEY = 'rejseplanen_offline_feedback';

export const FEEDBACK_TYPES = {
  bug: { label: 'bug', display: 'Bug Report', prefix: '[Bug]' },
  enhancement: { label: 'enhancement', display: 'Enhancement', prefix: '[Enhancement]' },
  suggestion: { label: 'suggestion', display: 'Suggestion', prefix: '[Suggestion]' }
};

export function collectDiagnostics(context = {}) {
  const isBrowser = typeof window !== 'undefined';
  const width = isBrowser ? window.innerWidth : 0;
  const height = isBrowser ? window.innerHeight : 0;
  const dpr = isBrowser ? (window.devicePixelRatio || 1) : 1;
  const standalone = isBrowser && Boolean(
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );

  return {
    userAgent: isBrowser ? window.navigator.userAgent : 'Node.js',
    viewport: `${width}x${height} (DPR: ${dpr})`,
    isStandalone: standalone,
    timestamp: new Date().toISOString(),
    ...context
  };
}

export function formatIssueBody(feedback, diagnostics = {}) {
  const meta = FEEDBACK_TYPES[feedback.type] || FEEDBACK_TYPES.suggestion;
  const contact = feedback.email?.trim() || 'Anonymous';

  return `### User Feedback

**Type:** ${meta.display}  
**Contact:** ${contact}  

#### Description
${feedback.description?.trim() || 'No description provided.'}

---
#### System Diagnostics
- **View:** ${diagnostics.activeTab || 'Unknown'} ${diagnostics.station ? `(${diagnostics.station})` : ''}
- **Viewport:** ${diagnostics.viewport || 'Unknown'}
- **PWA Standalone:** ${diagnostics.isStandalone ? 'Yes' : 'No'}
- **Platform:** ${diagnostics.userAgent || 'Unknown'}
- **Timestamp:** ${diagnostics.timestamp || new Date().toISOString()}
`;
}

export function buildFeedbackPayload(feedback, context = {}) {
  const meta = FEEDBACK_TYPES[feedback.type] || FEEDBACK_TYPES.suggestion;
  const diagnostics = collectDiagnostics(context);
  const title = `${meta.prefix} ${feedback.summary?.trim() || 'Feedback'}`;
  const body = formatIssueBody(feedback, diagnostics);

  return {
    title,
    body,
    labels: [meta.label, 'user-feedback'],
    rawFeedback: feedback,
    diagnostics
  };
}

export function queueOfflineFeedback(payload) {
  try {
    const existing = getQueuedFeedback();
    existing.push({ ...payload, queuedAt: new Date().toISOString() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to queue offline feedback', err);
  }
}

export function getQueuedFeedback() {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function clearQueuedFeedback() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch (err) {
    console.error('Failed to clear queued feedback', err);
  }
}

export async function submitFeedback(feedback, context = {}) {
  const payload = buildFeedbackPayload(feedback, context);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineFeedback(payload);
    return {
      offline: true,
      message: 'Feedback queued locally. It will be sent automatically when online.'
    };
  }

  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to submit feedback');
  }

  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/services/feedbackService.test.js -- --run`  
Expected: PASS (all 5 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/services/feedbackService.js src/services/feedbackService.test.js
git commit -m "feat: implement feedbackService with diagnostics, payload builder, and offline queue"
```

---

### Task 2: Backend Proxy Endpoint (Vite Dev Middleware & Serverless Function)

**Files:**
- Create: `api/feedback.js`
- Modify: `vite.config.js`
- Create: `tests/feedback-api.test.js`

**Interfaces:**
- Produces: `POST /api/feedback` endpoint taking `{ title, body, labels }` and returning `{ issueNumber, url, title }`.

- [ ] **Step 1: Write failing unit test for `api/feedback.js`**

Create `tests/feedback-api.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFeedbackRequest } from '../api/feedback.js';

describe('feedback API handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-POST requests with 405', async () => {
    const res = await handleFeedbackRequest({ method: 'GET', body: {} }, { token: 'mock-token', repo: 'owner/repo' });
    expect(res.status).toBe(405);
    expect(res.body.error).toContain('Method not allowed');
  });

  it('validates that title and body are required', async () => {
    const res = await handleFeedbackRequest({ method: 'POST', body: { title: '' } }, { token: 'mock-token', repo: 'owner/repo' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Title and body are required');
  });

  it('creates GitHub issue successfully when token and repo are configured', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ number: 55, html_url: 'https://github.com/owner/repo/issues/55' })
    });

    const res = await handleFeedbackRequest(
      {
        method: 'POST',
        body: { title: '[Bug] Fix layout', body: 'Details', labels: ['bug'] }
      },
      { token: 'secret-token', repo: 'owner/repo' }
    );

    expect(res.status).toBe(201);
    expect(res.body.issueNumber).toBe(55);
    expect(res.body.url).toBe('https://github.com/owner/repo/issues/55');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tests/feedback-api.test.js -- --run`  
Expected: FAIL with "Cannot find module '../api/feedback.js'"

- [ ] **Step 3: Write implementation of `api/feedback.js`**

Create `api/feedback.js`:

```javascript
export async function handleFeedbackRequest(req, env = {}) {
  if (req.method !== 'POST') {
    return {
      status: 405,
      body: { error: 'Method not allowed. Only POST is accepted.' }
    };
  }

  const { title, body, labels } = req.body || {};
  if (!title?.trim() || !body?.trim()) {
    return {
      status: 400,
      body: { error: 'Title and body are required.' }
    };
  }

  const token = env.token || process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = env.repo || process.env.GITHUB_FEEDBACK_REPO || 'imdeepthakkar/rejseplanen-ui';

  if (!token) {
    return {
      status: 503,
      body: {
        error: 'GitHub token not configured on server.',
        fallbackUrl: `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
      }
    };
  }

  try {
    const ghRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'rejseplanen-ui-feedback'
      },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim(),
        labels: Array.isArray(labels) ? labels : ['user-feedback']
      })
    });

    const data = await ghRes.json();
    if (!ghRes.ok) {
      return {
        status: ghRes.status,
        body: { error: data.message || 'GitHub API error', details: data }
      };
    }

    return {
      status: 201,
      body: {
        issueNumber: data.number,
        url: data.html_url,
        title: data.title
      }
    };
  } catch (err) {
    return {
      status: 500,
      body: { error: 'Internal server error while connecting to GitHub' }
    };
  }
}

// Default export for Vercel / Netlify / Node serverless runtimes
export default async function handler(req, res) {
  const result = await handleFeedbackRequest(req);
  return res.status(result.status).json(result.body);
}
```

- [ ] **Step 4: Update `vite.config.js` to provide local dev proxy for `/api/feedback`**

Modify `vite.config.js` to add custom middleware for `/api/feedback` so local dev works seamlessly without an external server:

```javascript
// In vite.config.js, import { handleFeedbackRequest } from './api/feedback.js';
// Inside plugins, add a dev middleware plugin:
{
  name: 'feedback-api-middleware',
  configureServer(server) {
    server.middlewares.use('/api/feedback', async (req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};
          const result = await handleFeedbackRequest({ method: req.method, body: parsedBody });
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Failed to process request' }));
        }
      });
    });
  }
}
```

- [ ] **Step 5: Run tests and verify PASS**

Run: `npm test tests/feedback-api.test.js -- --run`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/feedback.js vite.config.js tests/feedback-api.test.js
git commit -m "feat: implement /api/feedback proxy with local Vite dev middleware and serverless handler"
```

---

### Task 3: In-App Feedback Modal Component

**Files:**
- Create: `src/components/FeedbackModal.jsx`
- Create: `src/components/FeedbackModal.css`

**Interfaces:**
- Consumes: `submitFeedback`, `collectDiagnostics`, `FEEDBACK_TYPES` from `../services/feedbackService.js`
- Props:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `context?: { activeTab: string, station?: string }`

- [ ] **Step 1: Write `src/components/FeedbackModal.css`**

Create `src/components/FeedbackModal.css`:
- Glassmorphic `.feedback-overlay` with `backdrop-filter: blur(8px)` and responsive bottom-sheet / modal card.
- Modern category chip selectors with active indicator.
- Styled form inputs (`.feedback-input`, `.feedback-textarea`).
- Accordion toggle for `.feedback-diagnostics-preview`.
- Action buttons: `.feedback-cancel-btn` and `.feedback-submit-btn` (`background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%)`).
- Animated success screen with checkmark badge and issue link.

- [ ] **Step 2: Write `src/components/FeedbackModal.jsx`**

Implement `FeedbackModal.jsx`:
- Categories: Bug Report (`bug`), Enhancement (`enhancement`), Suggestion (`suggestion`).
- Input states: `type`, `summary`, `description`, `email`, `submitting`, `error`, `successResult`.
- Submit button text: **`Submit Feedback`** (no "to GitHub").
- Auto diagnostics display toggle.
- On success: shows issue number, direct GitHub link, and "Done" button.
- Clean escape key and backdrop click handlers for closing.

- [ ] **Step 3: Test compilation and verify with unit test or build**

Run: `npm run build`  
Expected: Build succeeds with `FeedbackModal.jsx` transformed.

- [ ] **Step 4: Commit**

```bash
git add src/components/FeedbackModal.jsx src/components/FeedbackModal.css
git commit -m "feat: add FeedbackModal component with category selector, diagnostics, and success state"
```

---

### Task 4: Integrate Feedback Button into macOS Titlebar

**Files:**
- Modify: `src/App.jsx:38-75`
- Modify: `src/index.css:95-120`

**Interfaces:**
- In `mac-titlebar`: add `mac-actions` containing `mac-feedback-btn` ("💬 Feedback") and `mac-install-btn`.
- In `App.jsx`: hold `isFeedbackOpen` state and render `<FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} context={{ activeTab }} />`.

- [ ] **Step 1: Update `src/index.css` for `.mac-feedback-btn`**

Add `.mac-feedback-btn` styling to `src/index.css`:
- Pill button matching titlebar height.
- Clean contrast: `background: #eff6ff; color: #0284c7; border: 1px solid rgba(2, 132, 199, 0.25)`.
- Hover/active transitions.

- [ ] **Step 2: Update `src/App.jsx`**

- Import `FeedbackModal` from `./components/FeedbackModal`.
- Import `MessageSquarePlus` icon from `lucide-react`.
- Add `const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);`.
- Render button in `.mac-titlebar`:
  ```jsx
  <button
    type="button"
    className="mac-feedback-btn"
    onClick={() => setIsFeedbackOpen(true)}
    title="Give feedback or report a bug"
    aria-label="Give feedback or report a bug"
  >
    <MessageSquarePlus size={12} />
    <span>Feedback</span>
  </button>
  ```
- Render `<FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} context={{ activeTab }} />`.

- [ ] **Step 3: Run existing test suite and verify no regressions**

Run: `npm test -- --run`  
Expected: All 43 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/index.css
git commit -m "feat: add Feedback trigger button to mac-titlebar and connect FeedbackModal"
```

---

### Task 5: End-to-End Playwright Verification

**Files:**
- Create: `tests/playwright-feedback.mjs`

- [ ] **Step 1: Write Playwright test script `tests/playwright-feedback.mjs`**

- Launches Chromium on mobile emulation (Pixel 7).
- Navigates to `http://localhost:5174/`.
- Verifies `💬 Feedback` button is present in the titlebar.
- Clicks `💬 Feedback` and verifies modal opens with categories (Bug, Enhancement, Suggestion).
- Fills in summary and description.
- Verifies system diagnostics are present.
- Verifies submit button says "Submit Feedback".
- Captures verified screenshot to `C:/Users/deept/.gemini/antigravity-ide/brain/bc2bcd46-083b-45b9-8394-6c007efd95af/feedback_feature_live_verified.png`.

- [ ] **Step 2: Run Playwright test script**

Run: `node tests/playwright-feedback.mjs`  
Expected: Test completes with exit code 0 and saves verified live screenshot.

- [ ] **Step 3: Run full verification checklist**

- `npm test -- --run` passes completely.
- `npm run build` succeeds cleanly.
- Visual inspection of captured live screenshot.

- [ ] **Step 4: Commit**

```bash
git add tests/playwright-feedback.mjs
git commit -m "test: add automated Playwright e2e test for in-app feedback modal"
```
