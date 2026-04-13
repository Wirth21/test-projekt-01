"use client";

import { useEffect, useState } from "react";

interface CacheInfo {
  name: string;
  entries: { url: string; size: number }[];
}

export function OfflineDebug() {
  const [caches_, setCaches] = useState<CacheInfo[]>([]);
  const [online, setOnline] = useState(true);
  const [swState, setSwState] = useState("unknown");
  const [show, setShow] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  async function loadCacheInfo() {
    setShow(true);
    try {
      const names = await caches.keys();
      const result: CacheInfo[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        const entries: { url: string; size: number }[] = [];
        for (const req of keys) {
          const url = typeof req === "string" ? req : req.url;
          let size = 0;
          try {
            const resp = await cache.match(req);
            if (resp) {
              const blob = await resp.clone().blob();
              size = blob.size;
            }
          } catch {}
          entries.push({ url, size });
        }
        result.push({ name, entries });
      }
      setCaches(result);
    } catch (e) {
      setCaches([{ name: "ERROR", entries: [{ url: String(e), size: 0 }] }]);
    }

    // SW state
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sw = reg.active || reg.waiting || reg.installing;
        setSwState(sw ? `${sw.state} (scope: ${reg.scope})` : "no worker");
      } else {
        setSwState("no registration");
      }
    } else {
      setSwState("not supported");
    }
  }

  const appShell = caches_.find((c) => c.name.includes("app"));
  const pdfCache = caches_.find((c) => c.name.includes("pdf"));
  const dashboardPages = appShell?.entries.filter((e) => e.url.includes("/dashboard")) ?? [];

  return (
    <div className="fixed bottom-2 right-2 z-50">
      {!show ? (
        <button
          onClick={loadCacheInfo}
          className="bg-black text-white text-xs px-3 py-1.5 rounded-full opacity-50 hover:opacity-100"
        >
          Debug
        </button>
      ) : (
        <div className="bg-black text-green-400 text-[10px] font-mono p-3 rounded-lg max-w-[400px] max-h-[80vh] overflow-auto shadow-xl">
          <div className="flex justify-between mb-2">
            <span className="font-bold text-white">Offline Debug</span>
            <button onClick={() => setShow(false)} className="text-red-400">✕</button>
          </div>

          <div className="mb-2">
            <span className={online ? "text-green-400" : "text-red-400"}>
              {online ? "● ONLINE" : "● OFFLINE"}
            </span>
            <span className="ml-3 text-gray-400">SW: {swState}</span>
          </div>

          <div className="mb-2 text-white font-bold">
            Caches ({caches_.length}):
          </div>
          {caches_.map((c) => (
            <div key={c.name} className="mb-2">
              <div className="text-yellow-400">{c.name} ({c.entries.length} entries)</div>
            </div>
          ))}

          <div className="mb-2 text-white font-bold">
            Dashboard Pages in App Cache ({dashboardPages.length}):
          </div>
          {dashboardPages.length === 0 && (
            <div className="text-red-400">KEINE SEITEN GECACHT!</div>
          )}
          {dashboardPages.map((e, i) => {
            // Shorten URL for display
            const short = e.url.replace(/https?:\/\/[^/]+/, "");
            return (
              <div key={i} className="truncate text-gray-300">
                {short} ({Math.round(e.size / 1024)}KB)
              </div>
            );
          })}

          <div className="mt-2 mb-2 text-white font-bold">
            PDFs in Cache ({pdfCache?.entries.length ?? 0}):
          </div>
          {(pdfCache?.entries ?? []).map((e, i) => {
            const short = e.url.replace(/https?:\/\/[^/]+/, "").substring(0, 60);
            return (
              <div key={i} className="truncate text-gray-300">
                {short}... ({Math.round(e.size / 1024)}KB)
              </div>
            );
          })}

          <button
            onClick={loadCacheInfo}
            className="mt-2 bg-gray-700 text-white text-[10px] px-2 py-1 rounded"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
