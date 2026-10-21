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

  const token = env.token ?? process.env.GITHUB_FEEDBACK_TOKEN;
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
