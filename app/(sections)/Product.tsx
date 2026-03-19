"use client";

import {
  VIEWPORT,
  badgePop,
  fadeUp,
  fadeLeft,
} from "@/components/ui/animations";
import { motion } from "framer-motion";
import { FeatureCard } from "../(components)/FeatureCard";

const features = [
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
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
    ),
    title: "Clinically Differentiated",
    description:
      "Full-chain, non-denatured collagen matrix that outperforms hydrolyzed alternatives in bioavailability and tissue integration studies.",
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
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    title: "Proven Clinical Outcomes",
    description:
      "Supported by peer-reviewed data showing measurable improvements in patient outcomes — giving you the science to close confidently.",
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
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    title: "Regulatory Compliant",
    description:
      "Fully compliant and market-ready. Focus on selling, not paperwork — we handle the backend so you can focus on revenue.",
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
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
    title: "Physician-Preferred Formula",
    description:
      "Designed with feedback from leading practitioners. Physicians ask for it by name — making reorders effortless and pipeline sticky.",
  },
];

export function Product() {
  return (
    <section id="product" className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          className="flex justify-center mb-6"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={badgePop}
        >
          <span className="bg-teal-50 text-teal-600 text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full border border-teal-200">
            The Product
          </span>
        </motion.div>

        <motion.div
          className="text-center mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={fadeUp}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Non-Hydrolyzed Collagen —{" "}
            <span className="text-teal-500">Redefining Regeneration</span>
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-lg leading-relaxed">
            Unlike traditional hydrolyzed collagen, our Non-Hydrolyzed Collagen
            preserves the full native molecular structure — delivering superior
            bioavailability and clinical outcomes that set you apart in every
            room.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            className="flex flex-col items-center justify-center"
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT}
            variants={fadeLeft}
          >
            <motion.div
              className="relative w-56 h-56 rounded-full border-2 border-teal-400/40 flex items-center justify-center bg-teal-50 shadow-xl shadow-teal-100"
              whileHover={{ scale: 1.04, rotate: 2 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <div className="w-44 h-44 rounded-full border border-teal-300/60 flex items-center justify-center bg-white">
                <div className="w-32 h-32 rounded-full bg-linear-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg">
                  <svg
                    className="w-14 h-14 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </motion.div>
            <motion.div className="mt-6 text-center" variants={fadeUp}>
              <p className="font-bold text-gray-800 text-lg">
                Non-Hydrolyzed Collagen™
              </p>
              <p className="text-teal-500 text-sm font-medium mt-1">
                Native Molecular Structure Preserved
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            className="flex flex-col gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12 } },
            }}
          >
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
