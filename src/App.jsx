import React, { useState } from 'react';
import './index.css';
import Tabs from './components/Tabs';
import JourneyPlanner from './components/JourneyPlanner';
import LiveDepartures from './components/LiveDepartures';
import { motion, AnimatePresence } from 'framer-motion';

import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineBanner from './components/OfflineBanner';
import { getDefaultTab } from './services/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => getDefaultTab());

  return (
    <div className="app-container">
      <OfflineBanner />
      <PWAInstallPrompt />
      <main className="main-content">
        <header className="brand-header">
          <h1>Rejseplanen</h1>
          <p className="brand-subtitle">Copenhagen Transit</p>
        </header>

        <div className="dashboard-card">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
          
          <div className="dashboard-content">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
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
