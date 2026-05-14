"use client";

import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Fire-and-forget analytics POST. Failures are silently ignored
 * so analytics never block or degrade the user experience.
 */
function logEvent(data: Record<string, unknown>) {
  const payload = JSON.stringify(data);

  // Prefer sendBeacon — truly non-blocking, survives page navigations
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/analytics", blob);
    return;
  }

  // Fallback: fetch with 5s timeout so it never blocks the page
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timeout));
}

/**
 * Hook that logs a page view on every route change.
 */
export function usePageView() {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    if (!pathname) return;
    logEvent({
      type: "page_view",
      page: pathname,
      uid: user?.uid || undefined,
      email: user?.email || undefined,
    });
  }, [pathname, user?.uid, user?.email]);
}

/**
 * Hook that returns a trackClick function.
 * Call it on button/link clicks to log user interactions.
 *
 * Usage:
 *   const trackClick = useTrackClick();
 *   <button onClick={() => { trackClick("refresh_scores"); handleRefresh(); }}>
 */
export function useTrackClick() {
  const pathname = usePathname();
  const { user } = useAuth();

  return useCallback(
    (action: string) => {
      logEvent({
        type: "click",
        page: pathname || "unknown",
        action,
        uid: user?.uid || undefined,
        email: user?.email || undefined,
      });
    },
    [pathname, user?.uid, user?.email]
  );
}
