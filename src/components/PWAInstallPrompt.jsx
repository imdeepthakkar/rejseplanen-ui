import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './PWAInstallPrompt.css';

export default function PWAInstallPrompt() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSDrawer, setShowIOSDrawer] = useState(false);

  useEffect(() => {
    // 1. Check if already installed in standalone mode
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true);

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if previously dismissed by the user
    try {
      if (localStorage.getItem('pwa_prompt_dismissed') === 'true') {
        setIsDismissed(true);
        return;
      }
    } catch (e) {
      // Storage access blocked or restricted
    }

    // 3. Detect iOS Safari
    const ua = navigator.userAgent;
    const isIOSDevice =
      /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOSDevice) {
      setIsIOS(true);
    }

    // 4. Capture Chromium/Android install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Support manual trigger for debugging/e2e testing or titlebar button
    const handleManualOpen = () => setShowIOSDrawer(true);
    const handleTriggerInstall = async () => {
      if (deferredPrompt) {
        try {
          await deferredPrompt.prompt();
          const choiceResult = await deferredPrompt.userChoice;
          if (choiceResult && choiceResult.outcome === 'accepted') {
            setIsInstalled(true);
          }
        } catch (err) {
          console.error('Error triggering PWA install prompt:', err);
        } finally {
          setDeferredPrompt(null);
        }
      } else {
        setShowIOSDrawer(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-show-ios-guide', handleManualOpen);
    window.addEventListener('pwa-trigger-install', handleTriggerInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-show-ios-guide', handleManualOpen);
      window.removeEventListener('pwa-trigger-install', handleTriggerInstall);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSDrawer(true);
      return;
    }

    if (!deferredPrompt) {
      setShowIOSDrawer(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch (err) {
      console.error('Error triggering PWA install prompt:', err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem('pwa_prompt_dismissed', 'true');
    } catch (e) {
      // Storage access blocked
    }
    setIsDismissed(true);
    setShowIOSDrawer(false);
  };

  const handleCloseDrawer = () => {
    setShowIOSDrawer(false);
  };

  if (isInstalled) {
    return null;
  }

  const showBanner = !isDismissed && Boolean(deferredPrompt || isIOS);

  if (!showBanner && !showIOSDrawer) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {showBanner && !showIOSDrawer && (
          <motion.div
            className="pwa-install-banner"
            role="region"
            aria-label="Install Rejseplanen App"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="pwa-banner-content">
              <img
                src="./pwa-192x192.png"
                alt="Rejseplanen logo"
                className="pwa-app-icon"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="pwa-banner-info">
                <span className="pwa-banner-title">Install Rejseplanen App</span>
                <span className="pwa-banner-subtitle">
                  Fast Copenhagen Transit &amp; Offline Access
                </span>
              </div>
            </div>

            <div className="pwa-banner-actions">
              <button
                type="button"
                className="pwa-btn-install"
                onClick={handleInstallClick}
                aria-label="Install Rejseplanen App"
              >
                <Download size={16} className="pwa-btn-icon" />
                <span>Install</span>
              </button>
              <button
                type="button"
                className="pwa-btn-dismiss"
                onClick={handleDismiss}
                aria-label="Dismiss install banner"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIOSDrawer && (
          <>
            <motion.div
              className="pwa-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCloseDrawer}
              aria-hidden="true"
            />
            <motion.div
              className="pwa-ios-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pwa-drawer-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="pwa-drawer-drag-indicator" />
              <div className="pwa-drawer-header">
                <div className="pwa-drawer-title-group">
                  <img
                    src="./apple-touch-icon.png"
                    alt="Rejseplanen"
                    className="pwa-drawer-app-icon"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div>
                    <h2 id="pwa-drawer-title" className="pwa-drawer-title">
                      {isIOS ? 'Install on iPhone & iPad' : 'Install Rejseplanen App'}
                    </h2>
                    <p className="pwa-drawer-subtitle">
                      {isIOS
                        ? 'Add Rejseplanen to your Home Screen for the full app experience'
                        : 'Add Rejseplanen to your Home Screen or install via your browser'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="pwa-drawer-close"
                  onClick={handleCloseDrawer}
                  aria-label="Close guide"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="pwa-drawer-steps">
                <div className="pwa-step-item">
                  <div className="pwa-step-number">1</div>
                  <div className="pwa-step-content">
                    <p className="pwa-step-text">
                      {isIOS ? (
                        <>Tap the <strong>Share</strong> button at the bottom of Safari:</>
                      ) : (
                        <>Tap the browser menu <strong>(⋮)</strong> or <strong>Share</strong> icon:</>
                      )}
                    </p>
                    <div className="pwa-step-badge">
                      <Share size={18} />
                      <span>{isIOS ? 'Share' : 'Menu / Share'}</span>
                    </div>
                  </div>
                </div>

                <div className="pwa-step-divider" />

                <div className="pwa-step-item">
                  <div className="pwa-step-number">2</div>
                  <div className="pwa-step-content">
                    <p className="pwa-step-text">
                      Select <strong>"Add to Home Screen"</strong> or <strong>"Install app"</strong>:
                    </p>
                    <div className="pwa-step-badge">
                      <PlusSquare size={18} />
                      <span>Add to Home Screen</span>
                    </div>
                  </div>
                </div>

                <div className="pwa-step-divider" />

                <div className="pwa-step-item">
                  <div className="pwa-step-number">3</div>
                  <div className="pwa-step-content">
                    <p className="pwa-step-text">
                      Confirm by tapping <strong>Install</strong> or <strong>Add</strong>:
                    </p>
                    <div className="pwa-step-badge pwa-badge-action">
                      <span>{isIOS ? 'Add' : 'Install / Add'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pwa-drawer-actions">
                <button
                  type="button"
                  className="pwa-btn-got-it"
                  onClick={handleDismiss}
                >
                  <Check size={18} />
                  <span>Got it</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
