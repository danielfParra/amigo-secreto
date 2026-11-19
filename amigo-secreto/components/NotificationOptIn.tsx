"use client";

import { useState, useSyncExternalStore } from "react";
import {
  dismissNotificationPrompt,
  getNotificationPermission,
  isNotificationPromptDismissed,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "@/lib/client/notifications";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Compact, dismissible opt-in card for browser/PWA notifications when the user hasn't decided yet. */
export default function NotificationOptIn() {
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const [permOverride, setPermOverride] = useState<NotificationPermissionState | null>(null);
  const [dismissedOverride, setDismissedOverride] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  if (!hydrated) return null;

  if (justEnabled) {
    return (
      <div className="notif-bar notif-bar-ok" role="status">
        <span>¡Listo! Te avisaremos cuando llegue un mensaje.</span>
      </div>
    );
  }

  const perm = permOverride ?? getNotificationPermission();
  const dismissed = dismissedOverride || isNotificationPromptDismissed();
  if (perm !== "default" || dismissed) return null;

  async function enable() {
    const next = await requestNotificationPermission();
    setPermOverride(next);
    if (next === "granted") {
      setJustEnabled(true);
    } else if (next === "denied") {
      dismissNotificationPrompt();
      setDismissedOverride(true);
    }
  }

  function dismiss() {
    dismissNotificationPrompt();
    setDismissedOverride(true);
  }

  return (
    <div className="notif-bar">
      <span className="notif-bar-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </span>
      <span className="notif-bar-text">¿Quieres recibir avisos cuando te escriban?</span>
      <div className="notif-bar-actions">
        <button type="button" className="notif-btn-on" onClick={enable}>
          Activar
        </button>
        <button type="button" className="notif-btn-off" onClick={dismiss} aria-label="No activar avisos por ahora">
          Ahora no
        </button>
      </div>
    </div>
  );
}
