"use client";

/**
 * Auto-logout after a period of user inactivity. Required by HIPAA Security
 * Rule §164.312(a)(2)(iii) ("automatic logoff") — the assumption being that
 * a workforce member walks away from a clinic computer without locking it
 * and the next person sees PHI.
 *
 * Activity signals: pointer movement, key press, scroll, click, touch. The
 * timer resets on any of these. When the timeout expires, we sign the user
 * out via the server action and redirect to /sign-in.
 *
 * Implementation notes:
 *   - Listeners use { passive: true } so we don't block scroll on
 *     touch / wheel events.
 *   - A short throttle on activity reset prevents firing setTimeout()
 *     thousands of times per second on heavy mouse-move flows.
 *   - `document.visibilityState === "hidden"` doesn't pause the timer
 *     intentionally — a user with the tab in the background isn't
 *     using the portal, so the timer should keep counting.
 *   - On document visibility change to "visible" we DON'T reset; the
 *     wall-clock comparison handles it.
 */

import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
] as const;

const ACTIVITY_RESET_THROTTLE_MS = 1000;

export interface UseIdleLogoutOptions {
  /** Idle window in ms. Defaults to 20 minutes. */
  timeoutMs?: number;
  /** Called when the timeout expires — typically a server signOut + redirect. */
  onTimeout: () => void | Promise<void>;
  /** Pass `false` to disable (e.g. user not signed in). */
  enabled?: boolean;
}

export function useIdleLogout({
  timeoutMs = 20 * 60 * 1000,
  onTimeout,
  enabled = true,
}: UseIdleLogoutOptions) {
  // Stash callback in a ref so changing the function reference doesn't
  // tear down and rebuild the listener on every render.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let lastActivity = Date.now();
    let lastReset = 0;
    let firedTimeout = false;

    // Single setInterval rather than setTimeout-reset-on-each-event — the
    // hot path (mousemove) just updates `lastActivity`, the cheap `Date.now()`,
    // and the interval reads it.
    const interval = window.setInterval(() => {
      if (firedTimeout) return;
      if (Date.now() - lastActivity >= timeoutMs) {
        firedTimeout = true;
        try {
          void onTimeoutRef.current();
        } catch (err) {
          console.error("[useIdleLogout] onTimeout threw:", err);
        }
      }
    }, 5000);

    const onActivity = () => {
      const now = Date.now();
      if (now - lastReset < ACTIVITY_RESET_THROTTLE_MS) return;
      lastReset = now;
      lastActivity = now;
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    return () => {
      window.clearInterval(interval);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [timeoutMs, enabled]);
}
