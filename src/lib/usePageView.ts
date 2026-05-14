"use client";

import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { doc, setDoc, collection } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

function parseBrowser(ua: string): string {
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  if (ua.includes("Chrome/") && ua.includes("Safari/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("MSIE") || ua.includes("Trident/")) return "IE";
  return "Other";
}

/**
 * Write analytics event directly to Firestore from the client.
 * Fire-and-forget — failures are silently ignored so analytics
 * never block or degrade the user experience.
 */
function logEvent(data: Record<string, unknown>) {
  try {
    const db = getFirebaseDb();
    const eventRef = doc(collection(db, "analytics"));
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setDoc(eventRef, {
      ...data,
      browser: parseBrowser(ua),
      userAgent: ua.slice(0, 256),
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  } catch {
    // Silently ignore — analytics should never break the app
  }
}

const LAST_VISIT_DEBOUNCE_MS = 3 * 60 * 1000;
const LAST_VISIT_STORAGE_KEY = "analytics_last_visit_ts";

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

    // Upsert last-visit record, debounced to once per 3 minutes
    if (user?.uid) {
      try {
        const lastWrite = parseInt(sessionStorage.getItem(LAST_VISIT_STORAGE_KEY) || "0", 10);
        if (Date.now() - lastWrite < LAST_VISIT_DEBOUNCE_MS) return;

        const db = getFirebaseDb();
        setDoc(doc(db, "analytics_last_visit", user.uid), {
          email: user.email || null,
          lastPage: pathname,
          lastVisit: new Date().toISOString(),
        })
          .then(() => sessionStorage.setItem(LAST_VISIT_STORAGE_KEY, String(Date.now())))
          .catch(() => {});
      } catch {
        // Silently ignore
      }
    }
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
