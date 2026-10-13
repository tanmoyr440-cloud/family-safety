import * as React from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const InstallPwaPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    // Check if dismissed in this session
    if (sessionStorage.getItem("fsn_pwa_dismissed") === "true") {
      setDismissed(true);
      return;
    }

    // Check if already in standalone display mode (installed)
    const isStandalone =
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      return;
    }

    // Android / Chrome: Capture beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // iOS Safari detection (non-standalone)
    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;

    if (isIos && !isStandalone) {
      // Show gentle iOS tip after a 3 second delay
      const timer = setTimeout(() => setShowIosTip(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosTip(false);
    sessionStorage.setItem("fsn_pwa_dismissed", "true");
  };

  if (dismissed) return null;

  // 1. Android / Desktop Chrome Install Prompt
  if (deferredPrompt) {
    return (
      <aside
        aria-label="App installation notice"
        className="fixed top-18 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-white border border-blue-200 rounded-2xl p-3.5 shadow-xl animate-in slide-in-from-top-3 duration-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Download className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Install Family Safety Net</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Add to your home screen for quick offline access and instant notifications.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss installation prompt"
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-medium text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl shadow-xs"
          >
            Install App
          </button>
        </div>
      </aside>
    );
  }

  // 2. iOS Safari Install Tip
  if (showIosTip) {
    return (
      <aside
        aria-label="iOS installation instructions"
        className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-slate-900 text-white rounded-2xl p-3.5 shadow-xl animate-in slide-in-from-bottom-3 duration-200 border border-slate-800"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Share className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-slate-100">Install on iPhone / iPad</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Tap <span className="text-white font-medium">Share</span> in Safari, then select{" "}
                <strong className="text-blue-400">Add to Home Screen</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss iOS install tip"
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  return null;
};
