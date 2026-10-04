import React, { useState, useEffect } from 'react';
import './index.css';
import Tabs from './components/Tabs';
import JourneyPlanner from './components/JourneyPlanner';
import LiveDepartures from './components/LiveDepartures';
import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';

import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineBanner from './components/OfflineBanner';
import { getDefaultTab } from './services/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => getDefaultTab());
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone === true);
      setIsStandalone(Boolean(standalone));
    };

    checkStandalone();
    const handleInstalled = () => setIsStandalone(true);
    window.addEventListener('appinstalled', handleInstalled);
    return () => window.removeEventListener('appinstalled', handleInstalled);
  }, []);

  return (
    <div className="app-container">
      <div className="modern-bg"></div>
      <OfflineBanner />
      <PWAInstallPrompt />
      <main className="main-content">
        <div className="mac-window">
          <div className="mac-titlebar">
            <div className="mac-buttons">
              <span className="mac-btn close"></span>
              <span className="mac-btn min"></span>
              <span className="mac-btn max"></span>
            </div>
            <div className="mac-title">Rejseplanen</div>
            {!isStandalone && (
              <button
                type="button"
                className="mac-install-btn"
                onClick={() => window.dispatchEvent(new CustomEvent('pwa-trigger-install'))}
                title="Install Rejseplanen App"
                aria-label="Install Rejseplanen App"
              >
                <Download size={12} />
                <span>Install</span>
              </button>
            )}
          </div>
          <div className="mac-content">
            <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {activeTab === 'journey' ? <JourneyPlanner /> : <LiveDepartures />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
