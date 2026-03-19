import Link from "next/link";
import { Shield, Mail, MapPin, ArrowLeft } from "lucide-react";

const sections = [
  {
    title: "Information We Collect",
    content: [
      {
        subtitle: "Personal Information",
        text: "We collect information that you provide directly to us, including your name, email address, phone number, professional role, and facility information when you create an account or use the Platform.",
      },
      {
        subtitle: "Transaction Data",
        text: "We collect transaction-related data such as order history, billing details, invoice records, and payment status.",
      },
      {
        subtitle: "Technical Information",
        text: "We may automatically collect technical information such as IP address, device type, browser information, and usage activity.",
      },
    ],
  },
  {
    title: "How We Use Your Information",
    items: [
      "Operate and maintain the Platform",
      "Process orders and manage accounts",
      "Facilitate billing and accounting through integrations such as QuickBooks",
      "Communicate with you regarding your account and orders",
      "Improve Platform functionality and user experience",
      "Comply with applicable legal obligations",
    ],
  },
  {
    title: "Legal Basis for Processing",
    text: "We process your data based on contractual necessity, legitimate business interests, and compliance with legal obligations. We do not sell your personal data to third parties.",
  },
  {
    title: "Data Sharing",
    text: "We may share your information with trusted service providers such as hosting services and QuickBooks for billing and accounting purposes, and with legal authorities if required by law.",
  },
  {
    title: "Data Security",
    text: "We implement reasonable administrative, technical, and physical safeguards to protect your information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.",
  },
  {
    title: "Data Retention",
    text: "We retain your data only as long as necessary to fulfill the purposes described in this Policy, comply with legal obligations, resolve disputes, and enforce our agreements.",
  },
  {
    title: "Your Rights",
    text: "You may request access to, correction of, or deletion of your personal data at any time by contacting us at ben@hbmedical.com. We will respond to your request in accordance with applicable law.",
  },
  {
    title: "International Data Transfers",
    text: "Your information may be processed in countries outside your jurisdiction. Where required, we implement appropriate safeguards such as standard contractual clauses to protect your data.",
  },
  {
    title: "Third-Party Integrations",
    text: "The Platform integrates with third-party services such as QuickBooks. When you use these integrations, your data may also be governed by the privacy policies of those third parties. We encourage you to review their policies.",
  },
  {
    title: "Cookies",
    text: "We use cookies and similar tracking technologies to enhance your experience and analyze Platform usage. You may control cookie preferences through your browser settings.",
  },
  {
    title: "Protected Health Information (PHI)",
    text: "The Platform is not intended to store Protected Health Information (PHI) as defined under HIPAA or other applicable healthcare privacy laws. Users are strictly prohibited from entering sensitive patient data unless expressly authorized. HB Medical Supplies is not a Covered Entity or Business Associate for purposes of HIPAA.",
    highlight: true,
  },
  {
    title: "Policy Updates",
    text: "We may update this Privacy Policy from time to time. Continued use of the Platform following any changes constitutes your acceptance of the revised Policy. We encourage you to review this page periodically.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#2db0b0]/10 rounded-2xl flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-[#2db0b0]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                Privacy Policy
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Effective Date: March 18, 2026 &nbsp;·&nbsp; HB Medical Supplies
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
          <p className="text-slate-600 leading-relaxed">
            HB Medical Supplies (&quot;Company&quot;, &quot;we&quot;,
            &quot;us&quot;, or &quot;our&quot;) is committed to protecting your
            privacy in accordance with applicable data protection laws. This
            Privacy Policy explains how we collect, use, share, and safeguard
            your information when you use our Platform.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section, idx) => (
            <div
              key={idx}
              className={`bg-white border rounded-2xl p-6 shadow-sm ${
                section.highlight
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200"
              }`}
            >
              <h2
                className={`text-base font-bold mb-3 ${
                  section.highlight ? "text-amber-800" : "text-slate-800"
                }`}
              >
                <span className="text-[#2db0b0] mr-2">{idx + 1}.</span>
                {section.title}
              </h2>

              {/* Sub-items */}
              {"content" in section && section.content && (
                <div className="space-y-3">
                  {section.content.map((c, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        {c.subtitle}
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {c.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Bullet list */}
              {"items" in section && section.items && (
                <ul className="space-y-1.5">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-600"
                    >
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2db0b0] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {/* Plain text */}
              {"text" in section && section.text && (
                <p
                  className={`text-sm leading-relaxed ${
                    section.highlight ? "text-amber-700" : "text-slate-600"
                  }`}
                >
                  {section.text}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-6 bg-[#2db0b0]/5 border border-[#2db0b0]/20 rounded-2xl p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">
            Contact Us
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            For questions regarding this Privacy Policy, please contact HB
            Medical Supplies:
          </p>
          <div className="space-y-2">
            <a
              href="mailto:ben@hbmedical.com"
              className="flex items-center gap-2 text-sm text-[#2db0b0] hover:underline"
            >
              <Mail className="w-4 h-4" />
              ben@hbmedical.com
            </a>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400" />
              1621 Central Avenue, Cheyenne, Wyoming 82001, United States
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
