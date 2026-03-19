// utils/quickbooks/client.ts  ← UPDATE (full file replacement)
// NO "use server" — this is an internal server-side utility module,
// imported only by other "use server" action files.

import { createClient } from "@/utils/supabase/server";
import { QB_CONFIG } from "@/utils/quickbooks/config";
import OAuthClient from "intuit-oauth";

// ── Get valid access token (refresh if expired) ───────────────────────────────

export async function getValidAccessToken(): Promise<{
  accessToken: string;
  realmId: string;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: connection, error } = await supabase
      .from("quickbooks_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !connection) return null;

    const now = new Date();
    const accessExpiry = new Date(connection.access_token_expires_at);

    // ── Fast path: token still valid ─────────────────────────────────────────
    if (accessExpiry > now) {
      return {
        accessToken: connection.access_token,
        realmId: connection.realm_id,
      };
    }

    // ── Token expired: re-read first to handle concurrent refresh ────────────
    // Another in-flight request may have already refreshed the token.
    // Re-fetching avoids double-refresh with an already-rotated refresh_token.
    const { data: fresh } = await supabase
      .from("quickbooks_connections")
      .select("access_token, access_token_expires_at")
      .eq("user_id", user.id)
      .single();

    if (fresh && new Date(fresh.access_token_expires_at) > now) {
      return { accessToken: fresh.access_token, realmId: connection.realm_id };
    }

    // ── Refresh ───────────────────────────────────────────────────────────────
    const credentials = btoa(`${QB_CONFIG.clientId}:${QB_CONFIG.clientSecret}`);

    const response = await fetch(QB_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
      }).toString(),
    });

    if (!response.ok) {
      console.error("[QB Client] Token refresh failed:", response.status);
      return null;
    }

    const tokens = await response.json();
    const newAccessExpiry = new Date(now.getTime() + tokens.expires_in * 1000);
    const newRefreshExpiry = new Date(
      now.getTime() + tokens.x_refresh_token_expires_in * 1000,
    );

    // ── Persist refreshed token — check result ────────────────────────────────
    const { error: updateErr } = await supabase
      .from("quickbooks_connections")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_token_expires_at: newAccessExpiry.toISOString(),
        refresh_token_expires_at: newRefreshExpiry.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", user.id);

    if (updateErr) {
      // Token refreshed but not saved — if we return it now the next request
      // will try to refresh again with the already-rotated refresh_token → hard fail.
      console.error(
        "[QB Client] Failed to persist refreshed token:",
        updateErr.message,
      );
      return null;
    }

    return {
      accessToken: tokens.access_token,
      realmId: connection.realm_id,
    };
  } catch (err) {
    console.error("[QB Client] getValidAccessToken error:", err);
    return null;
  }
}

// ── Soft QB request — returns null on failure ─────────────────────────────────

export async function qbRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: object,
): Promise<T | null> {
  const auth = await getValidAccessToken();
  if (!auth) {
    console.error("[QB Client] No valid access token");
    return null;
  }

  const url = `${QB_CONFIG.companyUrl}/v3/company/${auth.realmId}${path}?minorversion=65`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    // Truncate to avoid logging full sensitive QB error payloads
    const snippet = (await response.text()).slice(0, 300);
    console.error(
      `[QB Client] ${method} ${path} → ${response.status}`,
      snippet,
    );
    return null;
  }

  return response.json() as Promise<T>;
}

// ── Strict QB request — THROWS on failure ────────────────────────────────────

export async function qbRequestOrThrow<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: object,
): Promise<T> {
  const result = await qbRequest<T>(method, path, body);
  if (result === null) {
    throw new Error(`QB request failed: ${method} ${path}`);
  }
  return result;
}


// ── Bare client — just config, no token ──────────────────────────────────────
export function createQBClient() {
  return new OAuthClient({
    clientId: process.env.QB_CLIENT_ID!,
    clientSecret: process.env.QB_CLIENT_SECRET!,
    environment: process.env.QB_ENVIRONMENT as "sandbox" | "production",
    redirectUri: process.env.QB_REDIRECT_URI!,
  });
}

// ── Validated client — reads token from DB, refreshes if expired ─────────────
export async function getValidQBClient() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("QB_NOT_AUTHENTICATED");

  const { data: connection, error } = await supabase
    .from("quickbooks_connections")
    .select("access_token, refresh_token, realm_id, access_token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !connection) throw new Error("QB_NOT_CONNECTED");

  const client = createQBClient();
  client.setToken({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    realmId: connection.realm_id,
    token_type: "bearer",
    expires_in: 3600,
    x_refresh_token_expires_in: 8726400,
  });

  // Use DB expiry — more reliable than SDK's internal clock
  const isValid = new Date(connection.access_token_expires_at) > new Date();
  if (isValid) return client;

  // Access token expired — try refresh
  try {
    await client.refresh();
    const newToken = client.getToken();
    const now = new Date();

    // Save refreshed tokens back to DB
    await supabase
      .from("quickbooks_connections")
      .update({
        access_token: newToken.access_token,
        refresh_token: newToken.refresh_token,
        access_token_expires_at: new Date(now.getTime() + 3600 * 1000).toISOString(),
        refresh_token_expires_at: new Date(now.getTime() + 8726400 * 1000).toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", user.id);

    return client;
  } catch {
    throw new Error("QB_TOKEN_EXPIRED");
  }
}