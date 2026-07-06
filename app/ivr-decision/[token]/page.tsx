import type { Metadata } from "next";
import { loadIvrByToken } from "./actions";
import { DecisionForm } from "./DecisionForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IVR Review",
  robots: { index: false, follow: false },
};

/**
 * Public IVR review + decision page. Token is the auth — no portal login.
 * External approvers land here from the "Review IVR" links in the summary
 * email. Renders the patient/physician/product info + inline file preview,
 * then hands off to <DecisionForm /> for the actual Approve/Deny click.
 */
export default async function IvrDecisionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await loadIvrByToken(token);

  if (result.state !== "valid") {
    return <StateCard state={result.state} />;
  }

  const { ivr, files } = result;

  return (
    <div className="min-h-screen bg-[#f5f7fa] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-[#e5e7eb] overflow-hidden">
          <div className="bg-[#0f2d4a] text-white px-6 py-5">
            <div className="text-[11px] uppercase tracking-widest opacity-70">
              Meridian Portal · IVR Review
            </div>
            <h1 className="mt-1 text-[20px] font-semibold">
              Review this IVR and record your decision
            </h1>
            <p className="mt-2 text-[13px] opacity-80">
              This link is unique to you and expires{" "}
              {new Date(ivr.approvalExpiresAt).toLocaleDateString()}. Your click
              is logged for the audit trail.
            </p>
          </div>

          <div className="px-6 py-5 space-y-4 text-[13.5px] text-[#111827]">
            <section>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280] mb-2">
                Patient
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <ReadRow label="Name" value={ivr.patientName} />
                <ReadRow label="Date of Birth" value={ivr.patientDob} />
                <ReadRow label="Physician" value={ivr.physicianName} />
                <ReadRow
                  label="Physician NPI"
                  value={ivr.physicianNpi ?? "—"}
                />
                <ReadRow
                  label="Facility"
                  value={ivr.facilityName ?? "—"}
                  className="col-span-2"
                />
                <ReadRow
                  label="Products"
                  value={ivr.productSummary}
                  className="col-span-2"
                />
              </div>
            </section>

            <section>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280] mb-2">
                Attached document{files.length !== 1 ? "s" : ""}
              </h2>
              {files.length === 0 ? (
                <p className="text-[12px] text-[#6b7280] italic">
                  No files attached.
                </p>
              ) : (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-lg border border-[#e5e7eb] overflow-hidden bg-white"
                    >
                      <div className="flex items-center justify-between px-3 py-2 border-b border-[#eee] bg-[#f9fafb]">
                        <div className="text-[12.5px] font-medium truncate">
                          {f.fileName}
                        </div>
                        <a
                          href={f.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-[#0f2d4a] hover:underline shrink-0 ml-2"
                        >
                          Open in new tab
                        </a>
                      </div>
                      {/* Inline preview — browsers render PDFs and images
                          in iframes; DOCX etc. show as unsupported and
                          the user uses "Open in new tab". */}
                      <iframe
                        src={f.signedUrl}
                        title={f.fileName}
                        className="w-full h-[600px] bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <DecisionForm
            token={token}
            patientName={ivr.patientName}
          />
        </div>

        <p className="text-center text-[11px] text-[#6b7280] mt-4">
          Powered by Meridian Portal · Approver IP + browser are recorded on
          submit
        </p>
      </div>
    </div>
  );
}

function ReadRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10.5px] uppercase tracking-wide text-[#6b7280] font-semibold">
        {label}
      </div>
      <div className="text-[13px] mt-0.5">{value}</div>
    </div>
  );
}

function StateCard({
  state,
}: {
  state: "invalid" | "expired" | "already_decided" | "converted";
}) {
  const messages: Record<typeof state, { title: string; body: string }> = {
    invalid: {
      title: "Link not found",
      body: "This IVR review link is invalid or has been revoked. If you believe this is a mistake, contact the sender.",
    },
    expired: {
      title: "Link expired",
      body: "This IVR review link has expired. Ask the sender to reissue if the IVR is still pending your review.",
    },
    already_decided: {
      title: "Decision already recorded",
      body: "This IVR has already been approved or denied. No further action is needed.",
    },
    converted: {
      title: "IVR already converted to order",
      body: "This IVR was approved and has been turned into an order. No further action is needed.",
    },
  };
  const m = messages[state];
  return (
    <div className="min-h-screen bg-[#f5f7fa] py-12 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-[#e5e7eb] px-6 py-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#fef3c7] flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <h1 className="text-[18px] font-semibold text-[#111827]">{m.title}</h1>
        <p className="text-[13px] text-[#6b7280] mt-2 leading-relaxed">
          {m.body}
        </p>
      </div>
    </div>
  );
}
