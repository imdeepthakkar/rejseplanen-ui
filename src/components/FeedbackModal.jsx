import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bug,
  Lightbulb,
  Sparkles,
  Send,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { submitFeedback, collectDiagnostics } from '../services/feedbackService';
import './FeedbackModal.css';

export default function FeedbackModal({ isOpen, onClose, context = {} }) {
  const [type, setType] = useState('bug');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [showDiag, setShowDiag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fallbackUrl, setFallbackUrl] = useState(null);
  const [successResult, setSuccessResult] = useState(null);
  const [diagnostics, setDiagnostics] = useState({});

  useEffect(() => {
    if (isOpen) {
      setDiagnostics(collectDiagnostics(context));
      setError(null);
      setFallbackUrl(null);
      setSuccessResult(null);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim() || !description.trim()) {
      setError('Please provide both a summary and a description.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setFallbackUrl(null);

    try {
      const res = await submitFeedback({
        type,
        summary,
        description,
        email
      }, context);

      setSuccessResult(res);
      setSummary('');
      setDescription('');
      setEmail('');
    } catch (err) {
      setError(err.message || 'Failed to submit feedback');
      // If server returned a fallback GitHub URL (e.g., token missing)
      if (err.fallbackUrl) {
        setFallbackUrl(err.fallbackUrl);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setSuccessResult(null);
    setError(null);
    setFallbackUrl(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="feedback-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) resetAndClose();
          }}
        >
          <motion.div
            className="feedback-sheet"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
          >
            {/* Header */}
            <div className="feedback-header">
              <div className="feedback-title-group">
                <h2 id="feedback-dialog-title">Share Feedback</h2>
                <p>Bug reports, enhancements & ideas</p>
              </div>
              <button
                type="button"
                className="feedback-close-btn"
                onClick={resetAndClose}
                aria-label="Close dialog"
              >
                <X size={15} />
              </button>
            </div>

            {successResult ? (
              /* Success Screen */
              <div className="feedback-success-card">
                <div className="feedback-success-icon">
                  <Check size={28} />
                </div>
                <div className="feedback-success-title">Feedback Logged!</div>
                <div className="feedback-success-desc">
                  {successResult.offline
                    ? successResult.message
                    : 'Thank you! Your feedback has been received and sent directly to our development team.'}
                </div>

                <button
                  type="button"
                  className="feedback-done-btn"
                  onClick={resetAndClose}
                >
                  Done
                </button>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Category Selector */}
                <div className="feedback-type-selector">
                  <button
                    type="button"
                    className={`feedback-type-btn ${type === 'bug' ? 'selected' : ''}`}
                    onClick={() => setType('bug')}
                  >
                    <Bug size={16} />
                    <span>Bug Report</span>
                  </button>
                  <button
                    type="button"
                    className={`feedback-type-btn ${type === 'enhancement' ? 'selected' : ''}`}
                    onClick={() => setType('enhancement')}
                  >
                    <Lightbulb size={16} />
                    <span>Enhancement</span>
                  </button>
                  <button
                    type="button"
                    className={`feedback-type-btn ${type === 'suggestion' ? 'selected' : ''}`}
                    onClick={() => setType('suggestion')}
                  >
                    <Sparkles size={16} />
                    <span>Suggestion</span>
                  </button>
                </div>

                {/* Summary */}
                <div className="feedback-form-group">
                  <label htmlFor="feedback-summary">Summary</label>
                  <input
                    id="feedback-summary"
                    className="feedback-input"
                    type="text"
                    required
                    placeholder={
                      type === 'bug'
                        ? 'Short bug summary (e.g., Delay badge clipping)'
                        : type === 'enhancement'
                        ? 'Enhancement idea (e.g., Add dark mode toggle)'
                        : 'Your suggestion or idea'
                    }
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="feedback-form-group">
                  <label htmlFor="feedback-description">Description</label>
                  <textarea
                    id="feedback-description"
                    className="feedback-textarea"
                    required
                    placeholder={
                      type === 'bug'
                        ? 'Describe what happened and how to reproduce it...'
                        : 'Describe the feature and why it would be helpful...'
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Email (Optional) */}
                <div className="feedback-form-group">
                  <label htmlFor="feedback-email">
                    <span>Email</span>
                    <span className="feedback-optional-badge">Optional</span>
                  </label>
                  <input
                    id="feedback-email"
                    className="feedback-input"
                    type="email"
                    placeholder="your.email@example.com (for updates)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* System Diagnostics Accordion */}
                <div className="feedback-diagnostics-box">
                  <div
                    className="feedback-diagnostics-header"
                    onClick={() => setShowDiag(prev => !prev)}
                  >
                    <span>⚙️ Include Device Diagnostics</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="feedback-diagnostics-badge">● Auto</span>
                      {showDiag ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  </div>
                  {showDiag && (
                    <div className="feedback-diagnostics-content">
                      <div className="feedback-diag-row">
                        <span>View:</span>
                        <span>{diagnostics.activeTab || 'Live'}{diagnostics.station ? ` (${diagnostics.station})` : ''}</span>
                      </div>
                      <div className="feedback-diag-row">
                        <span>Viewport:</span>
                        <span>{diagnostics.viewport || 'Auto'}</span>
                      </div>
                      <div className="feedback-diag-row">
                        <span>PWA Mode:</span>
                        <span>{diagnostics.isStandalone ? 'Standalone' : 'Browser'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="feedback-error-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} />
                      <span>{error}</span>
                    </div>
                    {fallbackUrl && (
                      <a
                        href={fallbackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="feedback-fallback-btn"
                      >
                        Open on GitHub directly
                      </a>
                    )}
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  className="feedback-submit-btn"
                  disabled={submitting}
                >
                  <Send size={14} />
                  <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
