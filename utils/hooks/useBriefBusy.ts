"use client";

import { useEffect, useReducer, useRef } from "react";

/**
 * Emits `true` for a short window after any of the watched values change,
 * then `false`. Designed for client-paginated tables where filter / sort /
 * page changes are nearly instant but the user benefits from a visible
 * "Updating…" pulse so the click feels acknowledged.
 *
 * The first render does NOT trigger busy — busy only flips after a
 * subsequent change to any dep.
 *
 * Critically: this returns `true` SYNCHRONOUSLY during the render where the
 * deps changed — not after a `useEffect` commit. That's what removes the
 * 50–150ms lag you'd otherwise feel between clicking a sort header and the
 * indicator appearing. A short timer fires later to re-render and flip the
 * indicator back off when the duration expires.
 *
 * Usage:
 *   const isBusy = useBriefBusy(
 *     [page, sort, dir, ...filters, search],
 *     250,
 *   );
 */
export function useBriefBusy(deps: unknown[], durationMs = 250): boolean {
  // Detect dep changes during render by comparing a stable JSON signature
  // against the previous render's signature. JSON.stringify is good enough
  // for the small primitive arrays passed by the call sites.
  const sigRef = useRef<string | null>(null);
  const newSig = JSON.stringify(deps);
  const isFirstRender = sigRef.current === null;
  const changed = !isFirstRender && sigRef.current !== newSig;
  sigRef.current = newSig;

  // `expiry` is the wall-clock time at which busy should flip back off.
  // Updated synchronously in render when deps change so the same render
  // can return `true` without waiting for a useEffect commit.
  const expiryRef = useRef<number>(0);
  if (changed) {
    expiryRef.current = Date.now() + durationMs;
  }

  // Bare re-render trigger — fired by the timer below to flip busy off.
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const remaining = expiryRef.current - Date.now();
    if (remaining <= 0) return;
    const t = setTimeout(force, remaining + 5);
    return () => clearTimeout(t);
  });

  return Date.now() < expiryRef.current;
}
