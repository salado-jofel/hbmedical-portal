import { NextRequest, NextResponse } from "next/server";
import {
  isKnownContractTemplate,
  loadContractTemplate,
} from "@/lib/pdf/templates";
import { validateInviteToken } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";

/**
 * Serves a contract template PDF from `lib/pdf/templates/`. Used by the
 * signup page's preview iframes (replaces the Supabase signed URL that the
 * 6 sales-rep cards and the 2 provider cards used to request).
 *
 * Token gate: the request must carry a valid `?token=<invite_token>`. That
 * token is the same opaque secret in the invite email URL. This prevents
 * scraping the templates (which contain Kelsey's pre-filled signature on the
 * I-9 and will contain Dr. Pienkos's on the BAA once we bake him in).
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
  if (!token) {
    return new NextResponse("Missing token", { status: 401 });
  }

  const invite = await validateInviteToken(token);
  if (!invite) {
    return new NextResponse("Invalid or expired invite", { status: 401 });
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
