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

let store = {};
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { store = {}; }
};
globalThis.localStorage = localStorageMock;

describe('feedbackService', () => {
  beforeEach(() => {
    localStorageMock.clear();
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
