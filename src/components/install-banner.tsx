import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import logoUrl from "@/assets/logo.png";

const DISMISS_KEY = "poabiz-install-dismissed-at";
const DISMISS_DAYS = 7;

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS
    (navigator as any).standalone === true;
}
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

export function InstallBanner() {
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400_000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari doesn't fire beforeinstallprompt — show manual hint after a short delay.
    let t: any;
    if (isIOS()) t = setTimeout(() => { setIosHint(true); setShow(true); }, 1500);

    const onInstalled = () => { setShow(false); setPrompt(null); };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome !== "accepted") localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setPrompt(null); setShow(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50">
      <div className="bg-card border rounded-xl shadow-lg p-4 flex items-start gap-3">
        <img src={logoUrl} alt="PoaBiz OS" className="h-12 w-12 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Install PoaBiz OS</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {iosHint && !prompt
              ? "Tap Share, then 'Add to Home Screen' to install."
              : "Add to your home screen for fast access and a native feel."}
          </p>
          {!iosHint && prompt && (
            <Button size="sm" className="mt-2" onClick={install}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Install app
            </Button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
