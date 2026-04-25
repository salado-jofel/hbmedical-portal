"use client";

/**
 * Shared realtime hooks for order-related surfaces.
 *
 * Why this exists: most order list/detail surfaces outside the main
 * `/dashboard/orders` hub and the open `OrderDetailModal` were rendering
 * snapshots and staying stale until a manual refresh. These hooks bolt on
 * Supabase realtime with two patterns:
 *
 *   1. useSingleOrderRealtime(orderId, cb)
 *        — subscribes to UPDATEs on one orders row. Used by OrderQuickView.
 *
 *   2. useOrderUpdatesRefresh()
 *        — subscribes to all UPDATEs on the orders table and calls
 *          router.refresh() (debounced) so server-rendered surfaces re-fetch
 *          their props automatically. Client state is preserved by Next's
 *          router.refresh() semantics.
 *
 * Both hooks are defensive:
 *   - Clean up the channel on unmount so orphan subscriptions don't leak.
 *   - Debounce callbacks so bursts of updates don't trigger a storm of
 *     refetches / router.refresh calls.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_DEBOUNCE_MS = 350;

/**
 * Subscribes to UPDATE events for a single orders row. Fires `onChange`
 * after a short debounce. Pass `null` as orderId to no-op (useful for
 * dialogs that mount before an id is chosen).
 */
export function useSingleOrderRealtime(
  orderId: string | null | undefined,
  onChange: () => void,
) {
  // Callback is stashed in a ref so we can keep the subscription effect's
  // dep list tiny — otherwise every re-render would tear down and rebuild
  // the channel, which fires Supabase's REPLICATION_SLOT / INSERT barrage.
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!orderId) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`order-realtime-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => cbRef.current(), DEFAULT_DEBOUNCE_MS);
        },
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [orderId]);
}

/**
 * Subscribes to UPDATE / INSERT / DELETE on the orders table globally and
 * calls router.refresh() on any change (debounced). Lets server-rendered
 * surfaces (dashboards, sub-rep detail, commissions ledger) stay live
 * without manually re-fetching each data slice.
 *
 * Multiple components on the same page can each call this hook — Next
 * de-dupes router.refresh() internally so the cost is a single re-fetch
 * of the server component tree.
 */
export function useOrderUpdatesRefresh() {
  useTableUpdatesRefresh("orders");
}

/**
 * Same pattern as useOrderUpdatesRefresh but for the commissions table.
 * Use this on surfaces whose display depends on commission rows directly
 * (status change / void / adjustment / approval / payout assignment).
 *
 * Note: this needs `commissions` to be in the `supabase_realtime`
 * publication — see migration 20260425020000_add_commissions_to_realtime.sql.
 */
export function useCommissionUpdatesRefresh() {
  useTableUpdatesRefresh("commissions");
}

/**
 * Generic realtime refresh — subscribes to all write events on a single
 * public table and calls router.refresh() on change (debounced). Use this
 * for any list surface whose props come from a server component so edits
 * elsewhere in the app flow in automatically.
 *
 * Requires the table to be in the `supabase_realtime` publication (see
 * supabase/migrations/* additions). Throws nothing if it isn't — the
 * subscription just sits idle.
 */
export function useTableRealtimeRefresh(table: string) {
  useTableUpdatesRefresh(table);
}

function useTableUpdatesRefresh(table: string) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), DEFAULT_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`${table}-refresh-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table },
        schedule,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router, table]);
}
