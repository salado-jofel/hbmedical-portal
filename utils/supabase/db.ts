import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getSupabaseClient(): Promise<SupabaseClient> {
  return await createClient();
}

export async function dbInsert<T extends Record<string, unknown>, R = T>({
  table,
  payload,
  select,
}: {
  table: string;
  payload: T | T[];
  select?: string; // ← NEW: optional select to return inserted row
}) {
  const supabase = await getSupabaseClient();

  let query = supabase
    .from(table)
    .insert(Array.isArray(payload) ? payload : [payload]);

  if (select) {
    const { data, error } = await query.select(select).single();
    return { data: data as R | null, error };
  }

  const { error } = await query;
  return { data: null, error };
}

export async function dbSelect<T>({
  table,
  columns = "*",
  order,
  filter,
  filters,
}: {
  table: string;
  columns?: string;
  order?: { column: string; ascending?: boolean };
  filter?: { column: string; value: string };
  filters?: { column: string; value: string }[];
}): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const supabase = await getSupabaseClient();

  let query = supabase.from(table).select(columns);

  if (filter) {
    query = query.eq(filter.column, filter.value);
  }

  if (filters && filters.length > 0) {
    for (const f of filters) {
      query = query.eq(f.column, f.value);
    }
  }

  if (order) {
    query = query.order(order.column, { ascending: order.ascending ?? false });
  }

  const { data, error } = await query;

  return { data: data as T[] | null, error };
}

export async function dbUpdate<T extends Record<string, unknown>>({
  table,
  payload,
  column,
  value,
  guards,
}: {
  table: string;
  payload: Partial<T>;
  column: string;
  value: string;
  guards?: { column: string; value: string }[];
}) {
  const supabase = await getSupabaseClient();

  let query = supabase.from(table).update(payload).eq(column, value);

  if (guards && guards.length > 0) {
    for (const g of guards) {
      query = query.eq(g.column, g.value);
    }
  }

  const { data, error } = await query.select();

  return { data, error };
}

export async function dbDelete({
  table,
  column,
  value,
  guards,
}: {
  table: string;
  column: string;
  value: string;
  guards?: { column: string; value: string }[];
}) {
  const supabase = await getSupabaseClient();

  let query = supabase.from(table).delete().eq(column, value);

  if (guards && guards.length > 0) {
    for (const g of guards) {
      query = query.eq(g.column, g.value);
    }
  }

  const { error } = await query;

  return { error };
}
