import { handleFeedbackRequest } from '../../api/feedback.js';

export async function onRequest(context) {
  const { request, env } = context;

  // Handle CORS preflight
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

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    try {
      body = await request.text();
    } catch (_) {}
  }

  const result = await handleFeedbackRequest(
    { method: request.method, body },
    {
      token: env?.GITHUB_FEEDBACK_TOKEN,
      repo: env?.GITHUB_FEEDBACK_REPO
    }
  );

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
