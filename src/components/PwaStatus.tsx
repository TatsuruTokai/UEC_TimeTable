import { CloudOff, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export const PwaStatus = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | undefined>();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(undefined);
  };

  return (
    <div className="flex items-center gap-1">
      {!online ? (
        <div className="hidden min-h-10 items-center gap-2 rounded-md bg-amber-50 px-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900 sm:inline-flex">
          <CloudOff className="h-4 w-4" />
          オフライン
        </div>
      ) : null}
      {installPrompt ? (
        <Button onClick={install}>
          <Smartphone className="h-4 w-4" />
          追加
        </Button>
      ) : null}
    </div>
  );
};
