"use client";

/**
 * Collaborative-edit support for the four order forms (order_form, order_ivr,
 * order_form_1500, order_delivery_invoices). One generic hook so the four
 * form components don't each repeat ~100 lines of subscription glue.
 *
 * Two concerns rolled together:
 *
 *   1. **Remote-update awareness.** Subscribes to UPDATEs on the order's row
 *      in `table` filtered by `order_id`. When the row's `updated_at`
 *      changes from outside this client, flips `remoteChangedSinceLoad`. The
 *      caller decides what to do — silently reload if no unsaved edits, or
 *      show a banner if dirty.
 *
 *   2. **Presence.** Tracks who else has the form open via Supabase Realtime
 *      presence. Returns a deduped list of viewer names so the toolbar can
 *      render small chips.
 *
 * Both streams run on the same channel (`{channelKey}-{orderId}`) so each
 * mount only opens one websocket.
 */

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface FormViewer {
  name: string;
  sessionId: string;
  /** True when this presence entry is the current user — UI uses it to skip
   *  drawing yourself or to render a "you" badge. */
  isSelf: boolean;
}

export interface UseFormCollaborationResult {
  /** Viewers currently subscribed to this form's channel. NOT deduped by
   *  user — two tabs from the same user count as two sessions, the UI layer
   *  collapses by name when rendering. */
  viewers: FormViewer[];
  /** True when an `updated_at` arrived from realtime that differs from
   *  what the caller passed as `localUpdatedAt`. Caller prompts the user
   *  to reload. Reset via `acknowledgeRemoteChange()`. */
  remoteChangedSinceLoad: boolean;
  /** Freshest `updated_at` the hook has seen — from initial load or
   *  realtime. Caller passes this as `ifMatchUpdatedAt` on the next save. */
  latestUpdatedAt: string | null;
  /** Call after the caller has reloaded the form's server state. */
  acknowledgeRemoteChange: () => void;
}

interface UseFormCollaborationOpts {
  /** Postgres table name to subscribe to. Must be in the supabase_realtime
   *  publication (see migrations). All four forms already are. */
  table: string;
  /** Channel name prefix — short, lowercase, no orderId. e.g. "hcfa", "ivr",
   *  "order_form", "invoice". The hook appends `-${orderId}`. */
  channelKey: string;
  /** The order whose form row we're watching. */
  orderId: string;
  /** Display name for presence. Falsy → presence skipped. */
  userName: string | null;
  /** The `updated_at` the form was last loaded with (initial fetch or last
   *  successful save). Pass `null` until the form is loaded. */
  localUpdatedAt: string | null;
}

export function useFormCollaboration(
  opts: UseFormCollaborationOpts,
): UseFormCollaborationResult {
  const { table, channelKey, orderId, userName, localUpdatedAt } = opts;

  // Stable session id — new each time the component mounts. Two tabs from
  // the same user appear as two distinct sessions. crypto.randomUUID is
  // available in all modern browsers and Node.
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
  const sessionId = sessionIdRef.current;

  const [viewers, setViewers] = useState<FormViewer[]>([]);
  const [latestUpdatedAt, setLatestUpdatedAt] = useState<string | null>(
    localUpdatedAt,
  );
  const [remoteChangedSinceLoad, setRemoteChangedSinceLoad] = useState(false);

  // localUpdatedAt comes in as a prop and changes when the parent saves or
  // reloads. Sync it into our latest pointer so we don't false-positive on
  // our own writes.
  useEffect(() => {
    setLatestUpdatedAt(localUpdatedAt);
    setRemoteChangedSinceLoad(false);
  }, [localUpdatedAt]);

  useEffect(() => {
    if (!orderId) return;

    const supabase = createClient();
    const channel = supabase.channel(`${channelKey}-${orderId}`, {
      config: { presence: { key: sessionId } },
    });

    /* ── Presence ── */
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ name?: string; sessionId?: string }>
      >;
      const flat: FormViewer[] = [];
      for (const [key, entries] of Object.entries(state)) {
        for (const e of entries) {
          flat.push({
            name: e.name ?? "Someone",
            sessionId: e.sessionId ?? key,
            isSelf: (e.sessionId ?? key) === sessionId,
          });
        }
      }
      setViewers(flat);
    });

    /* ── Realtime row updates ── */
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table,
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        const newUpdatedAt = (payload.new as { updated_at?: string } | null)
          ?.updated_at;
        if (!newUpdatedAt) return;
        setLatestUpdatedAt((prev) => {
          if (prev === newUpdatedAt) return prev;
          setRemoteChangedSinceLoad(true);
          return newUpdatedAt;
        });
      },
    );

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      if (userName) {
        await channel.track({ name: userName, sessionId });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
    // sessionId is stable; orderId/table/channelKey are pinned per mount;
    // userName rarely changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, table, channelKey, userName]);

  return {
    viewers,
    remoteChangedSinceLoad,
    latestUpdatedAt,
    acknowledgeRemoteChange: () => setRemoteChangedSinceLoad(false),
  };
}
