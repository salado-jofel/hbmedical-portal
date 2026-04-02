"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { resend, PAYMENTS_FROM_EMAIL } from "@/lib/emails/resend";
import {
  generateInviteTokenSchema,
  mapInviteToken,
  mapInviteTokens,
  type IInviteToken,
  type IInviteTokenFormState,
  type RawInviteTokenRecord,
} from "@/utils/interfaces/invite-tokens";

const INVITE_TOKENS_TABLE = "invite_tokens";
const INVITE_TOKEN_SELECT = `
  *,
  created_by_profile:profiles!invite_tokens_created_by_fkey (
    id,
    first_name,
    last_name,
    email
  ),
  used_by_profile:profiles!invite_tokens_used_by_fkey (
    id,
    first_name,
    last_name,
    email
  ),
  facility:facilities!invite_tokens_facility_id_fkey (
    id,
    name
  )
`;

const LOGO_URL =
  "https://eyrefohymvvabazvmemq.supabase.co/storage/v1/object/public/spearhead-assets/assets/email/hb-logo-name-2.png";

/* -------------------------------------------------------------------------- */
/* getRepFacilityId — walks rep_hierarchy upward to find an owned facility    */
/* -------------------------------------------------------------------------- */

async function getRepFacilityId(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  // Check if this rep directly owns a facility
  const { data: ownedFacility } = await supabase
    .from("facilities")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (ownedFacility?.id) return ownedFacility.id;

  // Walk up the hierarchy to the parent rep and check theirs
  const { data: hierarchy } = await supabase
    .from("rep_hierarchy")
    .select("parent_rep_id")
    .eq("child_rep_id", userId)
    .limit(1)
    .maybeSingle();

  if (!hierarchy?.parent_rep_id) return null;

  return getRepFacilityId(hierarchy.parent_rep_id, supabase);
}

/* -------------------------------------------------------------------------- */
/* generateInviteToken                                                        */
/* -------------------------------------------------------------------------- */

export async function generateInviteToken(
  _prevState: IInviteTokenFormState | null,
  formData: FormData,
): Promise<IInviteTokenFormState> {
  console.log("[generateInviteToken] called, formData:", Object.fromEntries(formData));
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (role !== "sales_representative" && role !== "admin") {
      return { error: "Unauthorized.", success: false };
    }

    // Normalise "none" sentinel → null so UUID validation doesn't reject it
    const rawFacilityId = formData.get("facility_id") as string | null;
    const facilityId =
      !rawFacilityId || rawFacilityId.trim() === "" || rawFacilityId.trim() === "none"
        ? null
        : rawFacilityId.trim();

    const raw = {
      facility_id: facilityId,
      role_type: formData.get("role_type") as string,
      expires_in_days: formData.get("expires_in_days") ?? "30",
    };

    const parsed = generateInviteTokenSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error?.errors?.[0]?.message ?? "Invalid input.";
      return { error: msg, success: false };
    }

    const expiresAt = new Date(
      Date.now() + parsed.data.expires_in_days * 24 * 60 * 60 * 1000,
    ).toISOString();

    // For clinical roles, auto-resolve the rep's facility if none was provided
    let resolvedFacilityId = parsed.data.facility_id ?? null;
    if (!resolvedFacilityId && parsed.data.role_type !== "sales_representative") {
      resolvedFacilityId = await getRepFacilityId(user.id, supabase);
    }

    const { data: inserted, error } = await supabase
      .from(INVITE_TOKENS_TABLE)
      .insert({
        created_by: user.id,
        facility_id: resolvedFacilityId,
        role_type: parsed.data.role_type,
        expires_at: expiresAt,
      })
      .select("token")
      .single();

    if (error) {
      console.error("[generateInviteToken] Error:", JSON.stringify(error));
      return { error: error.message ?? error.code ?? "Failed to generate invite token.", success: false };
    }

    revalidatePath("/dashboard/onboarding");
    return { error: null, success: true, token: inserted.token };
  } catch (err) {
    console.error("[generateInviteToken] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* getMyInviteTokens                                                          */
/* -------------------------------------------------------------------------- */

export async function getMyInviteTokens(): Promise<IInviteToken[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  let query = supabase
    .from(INVITE_TOKENS_TABLE)
    .select(INVITE_TOKEN_SELECT)
    .order("created_at", { ascending: false });

  // Sales reps see only their own tokens; admins see all
  if (role === "sales_representative") {
    query = query.eq("created_by", user.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getMyInviteTokens] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to fetch invite tokens.");
  }

  return mapInviteTokens((data ?? []) as unknown as RawInviteTokenRecord[]);
}

/* -------------------------------------------------------------------------- */
/* validateInviteToken — public (no auth required)                           */
/* -------------------------------------------------------------------------- */

export async function validateInviteToken(
  token: string,
): Promise<IInviteToken | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(INVITE_TOKENS_TABLE)
    .select(INVITE_TOKEN_SELECT)
    .eq("token", token)
    .is("used_at", null)
    .single();

  if (error || !data) {
    return null;
  }

  const record = data as unknown as RawInviteTokenRecord;

  // Check expiry
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return null;
  }

  return mapInviteToken(record);
}

/* -------------------------------------------------------------------------- */
/* consumeInviteToken — called after successful invite signup                 */
/* -------------------------------------------------------------------------- */

export async function consumeInviteToken(
  token: string,
  usedBy: string,
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from(INVITE_TOKENS_TABLE)
    .update({
      used_by: usedBy,
      used_at: new Date().toISOString(),
    })
    .eq("token", token)
    .is("used_at", null);

  if (error) {
    console.error("[consumeInviteToken] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to consume invite token.");
  }
}

/* -------------------------------------------------------------------------- */
/* deleteInviteToken                                                          */
/* -------------------------------------------------------------------------- */

export async function deleteInviteToken(tokenId: string): Promise<void> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);

  const { error } = await supabase
    .from(INVITE_TOKENS_TABLE)
    .delete()
    .eq("id", tokenId);

  if (error) {
    console.error("[deleteInviteToken] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to delete invite token.");
  }

  revalidatePath("/dashboard/onboarding");
}

/* -------------------------------------------------------------------------- */
/* inviteSubRep                                                               */
/* -------------------------------------------------------------------------- */

const inviteSubRepSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email."),
});

export async function inviteSubRep(
  _prev: IInviteTokenFormState | null,
  formData: FormData,
): Promise<IInviteTokenFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (role !== "sales_representative" && role !== "admin") {
      return { error: "Unauthorized.", success: false };
    }

    const raw = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      email: formData.get("email") as string,
    };

    const parsed = inviteSubRepSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid input.";
      return { error: msg, success: false };
    }

    const { first_name, last_name, email } = parsed.data;

    const adminClient = createAdminClient();

    // Generate invite link
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { first_name, last_name, invited_by: user.id },
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/sign-in`,
        },
      });

    if (linkError || !linkData?.user) {
      console.error("[inviteSubRep] generateLink error:", linkError);
      return { error: linkError?.message ?? "Failed to create invite.", success: false };
    }

    const userId = linkData.user.id;
    const actionLink = linkData.properties?.action_link ?? "";

    // Create profile with sales_representative role
    await adminClient.from("profiles").upsert({
      id: userId,
      first_name,
      last_name,
      email,
      role: "sales_representative",
    });

    // Record invite token for tracking
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from(INVITE_TOKENS_TABLE).insert({
      created_by: user.id,
      facility_id: null,
      role_type: "sales_representative",
      expires_at: expiresAt,
    });

    // Send invite email via Resend
    if (actionLink) {
      await resend.emails.send({
        from: PAYMENTS_FROM_EMAIL,
        to: email,
        subject: "You've been invited to join HB Medical as a Sales Rep",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f4f7f9;margin:0;padding:0;}
.wrapper{background-color:#f4f7f9;padding:32px 16px;}
.container{max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;}
.header{padding:22px 28px 16px;text-align:center;border-bottom:1px solid #f1f5f9;}
.logo-img{display:block;margin:0 auto;width:176px;height:auto;border:0;}
.content{padding:28px 32px 34px;line-height:1.6;color:#334155;}
.h1{font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;}
p{margin:0 0 14px;font-size:14px;}
.btn-row{text-align:center;margin:24px 0 22px;}
.btn{background-color:#e8821a;color:#ffffff !important;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;display:inline-block;}
.muted{margin-top:20px;font-size:13px;color:#94a3b8;}
.footer{background-color:#f8fafc;padding:20px 24px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #f1f5f9;}
</style></head>
<body>
<div class="wrapper"><div class="container">
<div class="header"><img src="${LOGO_URL}" alt="HB Medical" width="176" class="logo-img" /></div>
<div class="content">
<h1 class="h1">You're invited to HB Medical Portal</h1>
<p>Hi ${first_name} ${last_name},</p>
<p>You've been invited to join the <strong>HB Medical Portal</strong> as a <strong>Sales Representative</strong>. Click below to set your password and get started.</p>
<div class="btn-row"><a href="${actionLink}" class="btn" target="_blank" rel="noopener noreferrer">Set Password &amp; Sign In</a></div>
<p>This invitation expires in 7 days. If you did not expect this, you can safely ignore it.</p>
<p class="muted">Questions? Contact your HB Medical admin.</p>
</div>
<div class="footer">&copy; 2026 HB Medical Portal.</div>
</div></div>
</body></html>
        `.trim(),
      });
    }

    revalidatePath("/dashboard/onboarding");
    return { success: true, error: null };
  } catch (err) {
    console.error("[inviteSubRep] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}
