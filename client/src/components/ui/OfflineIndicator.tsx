import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-white shadow-lg"
    >
      <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" />
      Sem conexão — verifique sua internet
    </div>
  );
}
