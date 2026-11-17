"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const ONBOARDED_KEY = "amigo-secreto:onboarded";

/** Remembers on this device that the welcome tour was seen (best effort: storage may be blocked). */
export function markOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    /* private window or blocked storage: the tour simply shows again from the home page */
  }
}

/** On the home page: first-time visitors on this device go to the welcome tour once. */
export default function FirstVisit() {
  const router = useRouter();
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {
      seen = true; // cannot remember it, so never trap anyone in a loop
    }
    if (!seen) router.replace("/bienvenida");
  }, [router]);
  return null;
}
