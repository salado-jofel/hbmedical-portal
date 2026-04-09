"use client";

import {
  VIEWPORT,
  badgePop,
  fadeUp,
  staggerContainer,
} from "@/components/ui/animations";
import { motion } from "framer-motion";
import { StarRating } from "../(components)/StarRating";

const testimonials = [
  {
    quote:
      "I've been in medical sales for 12 years. The Non-Hydrolyzed Collagen product basically sells itself once physicians see the data. I closed 6 new accounts in my first 45 days.",
    name: "Jason M.",
    role: "Independent Rep — Southeast",
    initials: "JM",
    highlight: false,
  },
  {
    quote:
      "HB Medical gave me a protected market with a clear lane. The commission structure is unlike anything I've seen — and the reorder rate is extraordinary. I'm building real residual income.",
    name: "Sarah R.",
    role: "Senior Rep — Midwest",
    initials: "SR",
    highlight: true,
  },
  {
    quote:
      "The clinical differentiation story is powerful. Physicians understand the science immediately. I'm having better conversations than I ever had with commodity products.",
    name: "David L.",
    role: "Medical Rep — Pacific Northwest",
    initials: "DL",
    highlight: false,
  },
];

export function Testimonials() {
  return (
    <section className="py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* ── Badge ── */}
        <motion.div
          className="flex justify-center mb-6"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={badgePop}
        >
          <span className="bg-[var(--navy)]/10 text-[var(--navy)] text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full border border-[var(--navy)]/20">
            Rep Stories
          </span>
        </motion.div>

        {/* ── Heading ── */}
        <motion.div
          className="text-center mb-14"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={fadeUp}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
            Reps Are{" "}
            <span className="text-[#f5a255] italic">Already Winning</span>
          </h2>
        </motion.div>

        {/* ── Cards ── */}
        <motion.div
          className="grid md:grid-cols-3 gap-6"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={staggerContainer}
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              variants={{
                hidden: {
                  opacity: 0,
                  y: 50,
                  rotate: i === 0 ? -2 : i === 2 ? 2 : 0,
                },
                visible: {
                  opacity: 1,
                  y: 0,
                  rotate: 0,
                  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`p-7 rounded-2xl flex flex-col justify-between cursor-default ${t.highlight
                ? "bg-[var(--navy)] text-white shadow-xl /30"
                : "bg-white border border-gray-100 shadow-sm"
                }`}
            >
              <div>
                <StarRating />
                <p
                  className={`text-sm leading-relaxed italic mb-6 ${t.highlight ? "text-white/85" : "text-gray-600"
                    }`}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${t.highlight
                    ? "bg-[#f5a255] text-white"
                    : "bg-[var(--navy)]/10 text-[var(--navy)]"
                    }`}
                >
                  {t.initials}
                </div>
                <div>
                  <p
                    className={`font-semibold text-sm ${t.highlight ? "text-white" : "text-gray-900"}`}
                  >
                    {t.name}
                  </p>
                  <p
                    className={`text-xs ${t.highlight ? "text-white/60" : "text-gray-400"}`}
                  >
                    {t.role}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
