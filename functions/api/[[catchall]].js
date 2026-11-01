export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight
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

  const url = new URL(request.url);
  // Rewrite /api/... to https://www.rejseplanen.dk/bin/rest.exe/...
  const targetPath = url.pathname.replace(/^\/api/, '');
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
