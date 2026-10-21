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

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
