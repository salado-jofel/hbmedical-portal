"use client";

import {
  VIEWPORT,
  badgePop,
  fadeUp,
  fadeLeft,
  fadeRight,
  staggerContainer,
} from "@/components/ui/animations";
import { motion } from "framer-motion";
import { DemoSessionRow } from "../(components)/DemoSessionRow";
import { DemoTopicItem } from "../(components)/DemoTopicItem";

const demoSessions = [
  { day: "Tuesday", time: "11:00 AM EST", status: "open" },
  { day: "Thursday", time: "2:00 PM EST", status: "open" },
  { day: "Friday", time: "10:00 AM EST", status: "limited" },
] satisfies { day: string; time: string; status: "open" | "limited" }[];

const demoTopics = [
  "The science behind Non-Hydrolyzed Collagen",
  "Clinical data and real-world case studies",
  "The sales process and objection handling",
  "Commission structure and market area terms",
  "Q&A with the Meridian team",
];

export function LiveDemo() {
  return (
    <section
      id="demo"
      className="py-24 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at bottom left, #1a7ab8 0%, var(--navy) 45%, #082d47 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* ── Badge ── */}
        <motion.div
          className="flex justify-center mb-10"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={badgePop}
        >
          <span className="bg-white/10 text-[#f5a255] text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full border border-white/20">
            See It Live
          </span>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* ── Left col ── */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT}
            variants={fadeLeft}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
              Watch the Product{" "}
              <span className="text-[#f5a255]">In Action</span>
            </h2>
            <p className="text-white/60 mb-8 text-lg leading-relaxed">
              Join one of our live weekly demo sessions and see exactly why
              physicians and clinics are switching to Non-Hydrolyzed Collagen.
            </p>

            {/* Topics list */}
            <motion.ul
              className="space-y-3 mb-10"
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT}
              variants={staggerContainer}
            >
              {demoTopics.map((topic) => (
                <DemoTopicItem key={topic} topic={topic} />
              ))}
            </motion.ul>

            {/* CTA — orange matches logo arc */}
            <motion.a
              href="tel:4042132994"
              className="inline-flex items-center gap-2 bg-[#e8821a] hover:bg-[#d4741a] text-white font-semibold px-7 py-3.5 rounded-full transition-colors text-sm shadow-lg shadow-orange-900/30"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              Talk to us — (404) 213-2994
            </motion.a>
          </motion.div>

          {/* ── Right col — session card ── */}
          <motion.div
            className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl p-6"
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT}
            variants={fadeRight}
          >
            {/* Live indicator */}
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#f5a255] animate-pulse" />
              <p className="text-white/80 text-sm font-semibold">
                Live Demo Sessions — Weekly
              </p>
            </div>

            {/* Session rows */}
            <motion.div
              className="space-y-3"
              initial="hidden"
              whileInView="visible"
              viewport={VIEWPORT}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.12 } },
              }}
            >
              {demoSessions.map((session) => (
                <DemoSessionRow
                  key={session.day}
                  day={session.day}
                  time={session.time}
                  status={session.status}
                />
              ))}
            </motion.div>

            {/* Footer note */}
            <div className="mt-6 flex items-center justify-center gap-2 text-white/40 text-xs">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              Secure Zoom · 60 min · No obligation
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
