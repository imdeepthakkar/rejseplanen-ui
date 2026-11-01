import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../public/_worker.js';

describe('Cloudflare Pages Advanced Worker (_worker.js)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('/api/feedback', () => {
    it('handles OPTIONS preflight', async () => {
      const request = new Request('https://my-app.pages.dev/api/feedback', { method: 'OPTIONS' });
      const res = await worker.fetch(request, {}, {});
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('rejects GET request with 405', async () => {
      const request = new Request('https://my-app.pages.dev/api/feedback', { method: 'GET' });
      const res = await worker.fetch(request, {}, {});
      expect(res.status).toBe(405);
      const data = await res.json();
      expect(data.error).toContain('Method not allowed');
    });

    it('returns 503 if GITHUB_FEEDBACK_TOKEN is missing', async () => {
      const request = new Request('https://my-app.pages.dev/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Bug', body: 'Broken' })
      });
      const res = await worker.fetch(request, {}, {});
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain('GitHub token not configured');
    });

    it('submits feedback to GitHub if token is provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ number: 123, html_url: 'https://github.com/imdeepthakkar/rejseplanen-ui/issues/123', title: 'Bug' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const request = new Request('https://my-app.pages.dev/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Bug', body: 'Broken' })
      });
      const res = await worker.fetch(request, { GITHUB_FEEDBACK_TOKEN: 'test-token', GITHUB_FEEDBACK_REPO: 'test/repo' }, {});
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.issueNumber).toBe(123);
    });
  });

  describe('/api/* proxy', () => {
    it('handles OPTIONS preflight for proxy', async () => {
      const request = new Request('https://my-app.pages.dev/api/location?input=Kbh', { method: 'OPTIONS' });
      const res = await worker.fetch(request, {}, {});
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('proxies /api/location to rejseplanen REST API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ LocationList: { StopLocation: [{ name: 'København H' }] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const request = new Request('https://my-app.pages.dev/api/location?input=K%C3%B8benhavn%20H&format=json', {
        method: 'GET'
      });
      const res = await worker.fetch(request, {}, {});
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://www.rejseplanen.dk/bin/rest.exe/location?input=K%C3%B8benhavn%20H&format=json',
        expect.objectContaining({
          method: 'GET',
          redirect: 'follow'
        })
      );
    });

    it('proxies /api/departureBoard to rejseplanen REST API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ DepartureBoard: { Departure: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const request = new Request('https://my-app.pages.dev/api/departureBoard?id=8600626&format=json', {
        method: 'GET'
      });
      const res = await worker.fetch(request, {}, {});
      expect(res.status).toBe(200);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://www.rejseplanen.dk/bin/rest.exe/departureBoard?id=8600626&format=json',
        expect.objectContaining({
          method: 'GET',
          redirect: 'follow'
        })
      );
    });
  });

  describe('static assets fallback', () => {
    it('calls env.ASSETS.fetch for non-API requests', async () => {
      const mockAssetFetch = vi.fn().mockResolvedValue(new Response('<html>Home</html>', { status: 200 }));
      const request = new Request('https://my-app.pages.dev/', { method: 'GET' });
      const res = await worker.fetch(request, { ASSETS: { fetch: mockAssetFetch } }, {});
      expect(res.status).toBe(200);
      expect(mockAssetFetch).toHaveBeenCalledWith(request);
    });
  });
});
