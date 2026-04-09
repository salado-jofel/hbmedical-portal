"use client";

import {
  VIEWPORT,
  badgePop,
  fadeUp,
  staggerContainerSlow,
} from "@/components/ui/animations";
import { motion } from "framer-motion";
import { BenefitCard } from "../(components)/BenefitCard";

const benefits = [
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    title: "Protected Sales Area",
    description:
      "Your market is yours. We enforce geographic exclusivity so you're never competing against another HB Medical rep.",
    badge: "ZIP-Level Protection",
    highlight: false,
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "Industry-Leading Commissions",
    description:
      "Top-tier commission structure with performance bonuses, recurring revenue on reorders, and accelerator tiers.",
    badge: "Recurring + Residual",
    highlight: true,
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 14l9-5-9-5-9 5 9 5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
        />
      </svg>
    ),
    title: "Full Sales Support & Training",
    description:
      "Clinical selling tools, physician-facing decks, objection handling playbooks, and live support from our team.",
    badge: "Onboard in 5 Days",
    highlight: false,
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    title: "First-Mover Advantage",
    description:
      "Non-Hydrolyzed Collagen is still emerging. Get in early and own your market before competitors catch on.",
    badge: "Category Creator",
    highlight: false,
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
        />
      </svg>
    ),
    title: "Marketing & Co-Op Dollars",
    description:
      "Branded materials, digital campaigns, and co-op marketing funds to help you generate leads and grow.",
    badge: "Done-For-You Assets",
    highlight: false,
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    title: "Dedicated Rep Success Team",
    description:
      "Your dedicated success manager is one call away to help close deals and troubleshoot challenges.",
    badge: "Direct Line Access",
    highlight: false,
  },
];

export function WhyUs() {
  return (
    <section
      id="why-us"
      className="py-24 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a7ab8 0%, var(--navy) 35%, #0d4a72 70%, #082d47 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* ── Badge ── */}
        <motion.div
          className="flex justify-center mb-6"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={badgePop}
        >
          <span className="bg-white/10 text-[#f5a255] text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full border border-white/20">
            Why HB Medical
          </span>
        </motion.div>

        {/* ── Heading ── */}
        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={fadeUp}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Built for <span className="text-[#f5a255] italic">Elite Reps</span>
          </h2>
          <p className="text-white/60 max-w-xl mx-auto text-lg leading-relaxed">
            We don&apos;t just hand you a product — we hand you a business.
            Here&apos;s what you unlock when you partner with HB Medical.
          </p>
        </motion.div>

        {/* ── Cards grid ── */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={staggerContainerSlow}
        >
          {benefits.map((benefit) => (
            <BenefitCard
              key={benefit.title}
              icon={benefit.icon}
              title={benefit.title}
              description={benefit.description}
              badge={benefit.badge}
              highlight={benefit.highlight}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
