"use client";

import { useEffect } from "react";

/**
 * Registers the clinician service worker once on mount, scoped to /clinician/
 * so it only controls the clinician PWA — never /staff, /console or /care.
 * Served from public/clinician/sw.js, so its default max scope is /clinician/
 * and no Service-Worker-Allowed header is required.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker.register("/clinician/sw.js", { scope: "/clinician/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
