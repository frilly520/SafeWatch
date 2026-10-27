import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, ArrowDown, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);

  useEffect(() => {
    // Register service worker (/sw.js) to satisfy Chrome PWA criteria
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    // Check if already running inside standalone / installed app mode
    const checkStandalone = () => {
      const standaloneMatch =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true;
      setIsStandalone(standaloneMatch);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const onChange = () => checkStandalone();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onChange);
    }

    // Detect iOS (iPhone, iPad, iPod)
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDetected =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iosDetected);

    // Intercept Android/Chrome native beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowIOSModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', onChange);
      }
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Automatically hide permanently once running inside standalone/app mode
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsStandalone(true);
        setDeferredPrompt(null);
      }
      return;
    }
    // On iOS Safari (or browsers where beforeinstallprompt is unavailable), open the guided Add to Home Screen modal
    setShowIOSModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        className="nyc-btn nyc-btn-blue px-3.5 py-2 min-h-[40px] text-xs whitespace-nowrap shrink-0"
        title="Install safeWatch to your device home screen"
      >
        <Download className="w-4 h-4" />
        <span>{deferredPrompt ? 'Install Web App' : 'Add to Shortcut'}</span>
      </button>

      {/* iOS Safari / Manual Add to Home Screen Instructions Popup pointing downwards */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/85 p-4">
          <div className="w-full max-w-md nyc-panel-yellow bg-[#12141a] text-[#f4f1ea] relative mb-4 sm:mb-0">
            <div className="h-2 w-full hazard-stripe-yellow" />
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b-2 border-[#2e3344] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 bg-[#ffd600] text-[#0a0a0d] border-2 border-[#f4f1ea] flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] font-bold uppercase text-[#00d2ff]">
                      {isIOS
                        ? 'IOS SAFARI HOME SCREEN SHORTCUT'
                        : 'STANDALONE APP SHORTCUT'}
                    </span>
                    <h3 className="font-graffiti text-2xl text-[#f4f1ea]">
                      Install safeWatch App
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSModal(false)}
                  className="nyc-btn nyc-btn-dark p-1.5 text-[#f4f1ea]"
                  aria-label="Close install instructions"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#a0a6b8] leading-relaxed">
                Launch <strong className="text-[#ffd600]">safeWatch</strong> full-screen without browser bars:
              </p>

              <div className="space-y-3 bg-[#0a0a0d] border-2 border-[#2e3344] p-4">
                <div className="flex items-center gap-3">
                  <span className="mta-bullet bg-[#00d2ff] text-[#0a0a0d]">
                    1
                  </span>
                  <div className="flex items-center gap-2 text-xs text-[#f4f1ea]">
                    <span>Tap the</span>
                    <span className="inline-flex items-center gap-1 bg-[#1c202b] border border-[#00d2ff] px-2 py-1 font-mono font-bold text-[#00d2ff]">
                      <Share className="w-3.5 h-3.5" /> Share
                    </span>
                    <span>button in the Safari bottom bar.</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="mta-bullet bg-[#ffd600] text-[#0a0a0d]">
                    2
                  </span>
                  <div className="flex items-center gap-2 text-xs text-[#f4f1ea]">
                    <span>Scroll &amp; tap</span>
                    <span className="inline-flex items-center gap-1 bg-[#1c202b] border border-[#ffd600] px-2 py-1 font-mono font-bold text-[#ffd600]">
                      <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
                    </span>
                  </div>
                </div>
              </div>

              {/* Downward-pointing indicator guiding to Safari bottom Share toolbar */}
              <div className="flex flex-col items-center justify-center pt-2 text-[#ffd600]">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider">
                  Tap Share Icon Below in Browser Bar
                </span>
                <ArrowDown className="w-6 h-6 mt-1 animate-bounce text-[#00d2ff]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
