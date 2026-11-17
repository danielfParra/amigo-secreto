"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export const ONBOARDED_KEY = "amigo-secreto:onboarded";

// Once the tour was seen or a redirect fired in this page load, never redirect again (guards against storage that cannot persist).
let seenThisLoad = false;

/** Remembers on this device that the welcome tour was seen (best effort: storage may be blocked). */
export function markOnboarded() {
  seenThisLoad = true;
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    /* private window or blocked storage: the tour simply shows again on the next page load */
  }
}

/** App-wide: first visit on this device goes to the welcome tour once, then back to the page they opened. */
export default function FirstVisit() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (seenThisLoad) return;
    if (pathname.startsWith("/bienvenida") || pathname.startsWith("/privacidad") || pathname.startsWith("/api")) return;
    let seen = true;
    try {
      seen = localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {
      seen = true; // cannot remember it, so never trap anyone in a loop
    }
    if (seen) return;
    seenThisLoad = true;
    router.replace(`/bienvenida?volver=${encodeURIComponent(pathname + window.location.search)}`);
  }, [router, pathname]);
  return null;
}
