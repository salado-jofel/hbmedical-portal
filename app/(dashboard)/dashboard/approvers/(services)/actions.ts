"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSupportOrAdminOrThrow } from "@/lib/supabase/auth";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";

const SELECT = "id, name, email, is_active, created_at, updated_at";
const APPROVERS_PATH = "/dashboard/approvers";

function mapRow(row: Record<string, unknown>): IExternalApprover {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getApprovers(): Promise<IExternalApprover[]> {
  const supabase = await createClient();
  await requireSupportOrAdminOrThrow(supabase);

  const { data, error } = await supabase
    .from("external_approvers")
    .select(SELECT)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("[getApprovers]", error);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function createApprover(input: {
  name: string;
  email: string;
}): Promise<
  | { success: true; approver: IExternalApprover }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    await requireSupportOrAdminOrThrow(supabase);

    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name) return { success: false, error: "Name is required." };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "A valid email is required." };
    }

    const { data, error } = await supabase
      .from("external_approvers")
      .insert({ name, email })
      .select(SELECT)
      .single();

    if (error) {
      // 23505 = unique_violation on the lower(email) index.
      if ((error as { code?: string }).code === "23505") {
        return {
          success: false,
          error: "An approver with that email already exists.",
        };
      }
      console.error("[createApprover]", error);
      return { success: false, error: "Failed to create approver." };
    }

    revalidatePath(APPROVERS_PATH);
    return {
      success: true,
      approver: mapRow(data as Record<string, unknown>),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

export async function updateApprover(
  id: string,
  patch: Partial<{ name: string; email: string; isActive: boolean }>,
): Promise<
  | { success: true; approver: IExternalApprover }
  | { success: false; error: string }
> {
  try {
    const supabase = await createClient();
    await requireSupportOrAdminOrThrow(supabase);

    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) return { success: false, error: "Name cannot be blank." };
      payload.name = name;
    }
    if (patch.email !== undefined) {
      const email = patch.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { success: false, error: "A valid email is required." };
      }
      payload.email = email;
    }
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("external_approvers")
      .update(payload)
      .eq("id", id)
      .select(SELECT)
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return {
          success: false,
          error: "Another approver already uses that email.",
        };
      }
      console.error("[updateApprover]", error);
      return { success: false, error: "Failed to update approver." };
    }

    revalidatePath(APPROVERS_PATH);
    return {
      success: true,
      approver: mapRow(data as Record<string, unknown>),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}
