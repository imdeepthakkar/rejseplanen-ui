export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Handle API feedback
    if (url.pathname === '/api/feedback' || url.pathname.endsWith('/api/feedback') || url.pathname.endsWith('/api/feedback/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed. Only POST is accepted.' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      let parsed = {};
      try {
        parsed = await request.json();
      } catch (_) {
        try {
          parsed = await request.text();
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        } catch (_) {}
      }

      const { title, body, labels } = parsed || {};
      if (!title?.trim() || !body?.trim()) {
        return new Response(JSON.stringify({ error: 'Title and body are required.' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const token = env?.GITHUB_FEEDBACK_TOKEN;
      const repo = env?.GITHUB_FEEDBACK_REPO || 'imdeepthakkar/rejseplanen-ui';

      if (!token) {
        return new Response(JSON.stringify({
          error: 'GitHub token not configured on server.',
          fallbackUrl: `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
        }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
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
          return new Response(JSON.stringify({ error: data.message || 'GitHub API error', details: data }), {
            status: ghRes.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        return new Response(JSON.stringify({
          issueNumber: data.number,
          url: data.html_url,
          title: data.title
        }), {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Internal server error while connecting to GitHub' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 2. Handle Rejseplanen API proxying
    if (url.pathname.includes('/api/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        });
      }

      const apiIndex = url.pathname.indexOf('/api/');
      const targetPath = url.pathname.slice(apiIndex + 4); // /location or /departureBoard
      const targetUrl = `https://www.rejseplanen.dk/bin/rest.exe${targetPath}${url.search}`;

      const headers = new Headers();
      headers.set('Accept', request.headers.get('accept') || 'application/json, text/plain, */*');
      headers.set('User-Agent', request.headers.get('user-agent') || 'Mozilla/5.0');
      if (request.headers.get('content-type')) {
        headers.set('Content-Type', request.headers.get('content-type'));
      }

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers,
          body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : undefined,
          redirect: 'follow'
        });

        const resHeaders = new Headers(response.headers);
        resHeaders.set('Access-Control-Allow-Origin', '*');
        resHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: resHeaders
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to proxy request to Rejseplanen', message: err.message }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 3. Fallback to static assets
    if (env?.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
        return env.ASSETS.fetch(new URL('/', request.url));
      }
      return assetRes;
    }

    return new Response('Not found', { status: 404 });
  }
};
