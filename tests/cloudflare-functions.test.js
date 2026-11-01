import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequest as feedbackHandler } from '../functions/api/feedback.js';
import { onRequest as catchallHandler } from '../functions/api/[[catchall]].js';

describe('Cloudflare Pages Functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('feedbackHandler', () => {
    it('handles OPTIONS preflight', async () => {
      const request = new Request('https://rejseplanen-ui.pages.dev/api/feedback', { method: 'OPTIONS' });
      const res = await feedbackHandler({ request, env: {} });
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('rejects GET request with 405', async () => {
      const request = new Request('https://rejseplanen-ui.pages.dev/api/feedback', { method: 'GET' });
      const res = await feedbackHandler({ request, env: {} });
      expect(res.status).toBe(405);
      const data = await res.json();
      expect(data.error).toContain('Method not allowed');
    });

    it('processes feedback POST and passes env variables', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ number: 99, html_url: 'https://github.com/imdeepthakkar/rejseplanen-ui/issues/99', title: 'Test issue' })
      });

      const request = new Request('https://rejseplanen-ui.pages.dev/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test issue', body: 'Test body', labels: ['test'] })
      });

      const res = await feedbackHandler({
        request,
        env: { GITHUB_FEEDBACK_TOKEN: 'cf-secret-token', GITHUB_FEEDBACK_REPO: 'test-org/test-repo' }
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.issueNumber).toBe(99);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/test-org/test-repo/issues',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer cf-secret-token'
          })
        })
      );
    });
  });

  describe('catchallHandler', () => {
    it('handles OPTIONS preflight', async () => {
      const request = new Request('https://rejseplanen-ui.pages.dev/api/location?input=Kbh', { method: 'OPTIONS' });
      const res = await catchallHandler({ request });
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('proxies /api/location to https://www.rejseplanen.dk/bin/rest.exe/location', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ LocationList: { StopLocation: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const request = new Request('https://rejseplanen-ui.pages.dev/api/location?input=K%C3%B8benhavn&format=json', {
        method: 'GET'
      });

      const res = await catchallHandler({ request });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://www.rejseplanen.dk/bin/rest.exe/location?input=K%C3%B8benhavn&format=json',
        expect.objectContaining({
          method: 'GET',
          redirect: 'follow'
        })
      );
    });

    it('returns 502 when backend fetch fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const request = new Request('https://rejseplanen-ui.pages.dev/api/trip?originId=1&destId=2', { method: 'GET' });
      const res = await catchallHandler({ request });
      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.error).toContain('Failed to proxy request');
    });
  });
});
