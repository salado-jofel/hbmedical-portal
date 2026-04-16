// Shared constants for onboarding server actions — no "use server" so all
// "use server" sibling files can import freely without re-export restrictions.

export const INVITE_TOKENS_TABLE = "invite_tokens";

export const INVITE_TOKEN_SELECT = `
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
    email,
    has_completed_setup,
    created_facility:facilities!facilities_user_id_fkey (
      id,
      name
    )
  ),
  facility:facilities!invite_tokens_facility_id_fkey (
    id,
    name
  )
`;

export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

export const LOGO_URL =
  "https://ersdsmuybpfvgvaiwcgl.supabase.co/storage/v1/object/public/hbmedical-bucket-public/assets/hb-logo-name-2%20(1).png";
