import Link from "next/link";
import { FileText, Mail, MapPin, ArrowLeft, AlertTriangle } from "lucide-react";

const sections = [
  {
    title: "Platform Description",
    text: "The Platform is a medical ordering and account management system intended for use by authorized licensed healthcare providers, medical facilities, sales representatives, and administrative personnel. It enables users to manage facility information, place and manage orders for surgical collagen and related products, and integrate with third-party systems such as QuickBooks for billing and accounting purposes.",
  },
  {
    title: "User Eligibility & Representations",
    text: "You represent and warrant that you are authorized to use the Platform, including acting on behalf of a medical facility or healthcare organization. All information provided during registration and use must be accurate and complete.",
  },
  {
    title: "Role-Specific Responsibilities",
    content: [
      {
        subtitle: "Healthcare Providers & Facilities",
        text: "Solely responsible for all orders placed under their accounts and for all clinical decisions regarding product use.",
      },
      {
        subtitle: "Sales Representatives",
        text: "May assist with account setup and order facilitation but cannot place orders without proper authorization.",
      },
      {
        subtitle: "Administrative Users",
        text: "Responsible for managing user permissions and account-level access controls.",
      },
    ],
  },
  {
    title: "Account Security",
    text: "You are responsible for maintaining the confidentiality of your account credentials. You must notify HB Medical Supplies immediately at ben@hbmedical.com if you become aware of any unauthorized access to your account.",
  },
  {
    title: "Ordering & Third-Party Integration",
    text: "Orders are subject to product availability and pricing at the time of placement. Billing data may be transmitted to third-party systems such as QuickBooks. You remain solely responsible for verifying the accuracy of all orders regardless of any system errors or integration issues.",
  },
  {
    title: "Third-Party Disclaimers",
    text: "HB Medical Supplies is not responsible for errors, outages, or data loss caused by third-party services including but not limited to QuickBooks. Use of third-party integrations is subject to the terms and conditions of those providers.",
  },
  {
    title: "Medical Disclaimer",
    text: "HB Medical Supplies does not provide medical advice, diagnosis, or treatment recommendations. All clinical decisions are the sole responsibility of licensed healthcare professionals. The Platform is a transactional and account management tool only.",
    highlight: true,
  },
  {
    title: "Compliance",
    text: "You agree to comply with all applicable federal, state, and local healthcare laws, regulations, and product guidelines when using the Platform, including but not limited to laws governing the purchase, use, and distribution of medical products.",
  },
  {
    title: "License Grant",
    items: [
      "A limited, non-exclusive, non-transferable, and revocable license is granted to access and use the Platform solely for its intended purposes.",
      "You may not reverse engineer, decompile, or disassemble any part of the Platform.",
      "You may not distribute, sublicense, or resell access to the Platform.",
      "You may not use the Platform for any unlawful purpose.",
    ],
  },
  {
    title: "Warranties & Disclaimer",
    text: 'The Platform is provided on an "as is" and "as available" basis. HB Medical Supplies makes no warranties, express or implied, regarding uninterrupted operation, fitness for a particular purpose, or error-free performance.',
  },
  {
    title: "Limitation of Liability",
    text: "To the maximum extent permitted by law, any liability of HB Medical Supplies shall be limited to the total amount paid by you within the twelve (12) months preceding the claim. In no event shall the Company be liable for indirect, incidental, consequential, or punitive damages.",
    highlight: true,
  },
  {
    title: "Indemnification",
    text: "You agree to defend, indemnify, and hold harmless HB Medical Supplies and its officers, directors, employees, and agents from any claims, damages, or expenses (including reasonable attorneys' fees) arising from your misuse of the Platform, violation of applicable law, or breach of this Agreement.",
  },
  {
    title: "Termination",
    text: "HB Medical Supplies reserves the right to suspend or terminate your access to the Platform at any time for violations of this Agreement, suspected misuse, or any other reason at its sole discretion, with or without notice.",
  },
  {
    title: "Governing Law",
    text: "This Agreement shall be governed by and construed in accordance with the laws of the State of Wyoming, United States, without regard to its conflict of law provisions. Any disputes shall be resolved exclusively in the courts of Wyoming.",
  },
  {
    title: "Updates to this Agreement",
    text: "HB Medical Supplies may update this Agreement at any time. Continued use of the Platform following any changes constitutes your acceptance of the revised terms. We encourage you to review this Agreement periodically.",
  },
];

export default function EulaPage() {
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
              <FileText className="w-6 h-6 text-[#2db0b0]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                End User License Agreement
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
            This End User License Agreement (&quot;Agreement&quot;) is a legally
            binding agreement between you (&quot;User&quot;, &quot;you&quot;)
            and HB Medical Supplies (&quot;Company&quot;, &quot;we&quot;,
            &quot;us&quot;, or &quot;our&quot;) governing your access to and use
            of the Platform. By accessing or using the Platform, you agree to be
            bound by the terms of this Agreement.
          </p>
        </div>

        {/* Important notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">Important:</span> Please read this
            Agreement carefully before using the Platform. If you do not agree
            to these terms, do not access or use the Platform.
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
            For questions regarding this Agreement, please contact HB Medical
            Supplies:
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
