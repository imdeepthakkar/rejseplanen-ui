import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './OfflineBanner.css';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? !navigator.onLine
      : false;
  });
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer = null;

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = setTimeout(() => {
        setShowReconnected(false);
      }, 2500);
    };

    const handleOffline = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      setShowReconnected(false);
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          key="offline-alert"
          className="offline-banner offline-banner--warning"
          role="alert"
          aria-live="assertive"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="offline-banner-content">
            <WifiOff size={18} className="offline-banner-icon" aria-hidden="true" />
            <span className="offline-banner-text">
              You are offline. Live transit departures and route searching require an internet connection.
            </span>
          </div>
        </motion.div>
      )}

      {!isOffline && showReconnected && (
        <motion.div
          key="online-alert"
          className="offline-banner offline-banner--online"
          role="status"
          aria-live="polite"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="offline-banner-content">
            <Wifi size={18} className="offline-banner-icon" aria-hidden="true" />
            <span className="offline-banner-text">
              Back online - Connection restored
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
