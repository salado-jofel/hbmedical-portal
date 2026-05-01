import { NextRequest, NextResponse } from "next/server";
import {
  isKnownContractTemplate,
  loadContractTemplate,
} from "@/lib/pdf/templates";
import { validateInviteToken } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { createClient } from "@/lib/supabase/server";

/**
 * Serves a contract template PDF from `lib/pdf/templates/`. Two access modes:
 *  - `?token=<invite_token>` — used by the invite-signup preview iframes
 *  - Authenticated session — used by the post-login /onboarding/contracts gate
 *    (legacy users who never signed during invite signup)
 *
 * Either path is sufficient; both prevent scraping the templates (which
 * contain pre-filled signatures on I-9 and the BAA Meridian-side signer).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!isKnownContractTemplate(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const token = request.nextUrl.searchParams.get("token");
  let authorized = false;

  if (token) {
    const invite = await validateInviteToken(token);
    if (invite) authorized = true;
  } else {
    // Fall back to authenticated session for the post-login gate flow.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) authorized = true;
  }

  if (!authorized) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const bytes = await loadContractTemplate(file);
  return new NextResponse(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // 5-min client cache is fine — templates are static; if we replace one
      // via a deploy the user's next page load (post-deploy) fetches fresh.
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${file}"`,
    },
  });
}
