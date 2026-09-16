"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Installability (offline support, "add to home screen") is a
      // progressive enhancement — a failed registration must not break the
      // app — but it must not be silent either, or a broken deployment of
      // sw.js could go unnoticed indefinitely.
      console.error("[sw] registration failed", err);
    });
  }, []);

  return null;
}
