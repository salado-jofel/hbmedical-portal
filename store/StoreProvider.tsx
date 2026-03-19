"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { AppStore, store } from "./store";

// ─── Types ────────────────────────────────────────────────────────────────────
// Export AppStore from store.ts first — add this line to store.ts:
// export type AppStore = typeof store

type StoreProviderProps = {
  children: React.ReactNode;
};

export function StoreProvider({ children }: StoreProviderProps) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = store;
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
