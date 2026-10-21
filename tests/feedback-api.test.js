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

  it('returns 503 with fallback URL when token is not configured', async () => {
    const res = await handleFeedbackRequest(
      {
        method: 'POST',
        body: { title: '[Bug] Issue', body: 'Details', labels: ['bug'] }
      },
      { token: '', repo: 'owner/repo' }
    );
    expect(res.status).toBe(503);
    expect(res.body.fallbackUrl).toContain('https://github.com/owner/repo/issues/new');
  });

  it('creates GitHub issue successfully when token and repo are configured', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ number: 55, html_url: 'https://github.com/owner/repo/issues/55', title: '[Bug] Fix layout' })
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
