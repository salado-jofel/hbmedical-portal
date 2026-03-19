"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeUp, staggerContainer } from "@/components/ui/animations";
import { AnimatedStat } from "../(components)/AnimateStat";

const DOTS = [
  { top: "8%", left: "12%" },
  { top: "15%", left: "72%" },
  { top: "22%", left: "38%" },
  { top: "35%", left: "88%" },
  { top: "48%", left: "5%" },
  { top: "55%", left: "55%" },
  { top: "62%", left: "25%" },
  { top: "70%", left: "80%" },
  { top: "78%", left: "45%" },
  { top: "85%", left: "15%" },
  { top: "90%", left: "65%" },
  { top: "5%", left: "50%" },
];

export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20"
      style={{
        background:
          "radial-gradient(ellipse at top, #0d5a6a 0%, #0a3040 40%, #061d28 100%)",
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {DOTS.map((pos, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/20"
            style={{ top: pos.top, left: pos.left }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        <motion.h1
          className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ delay: 0.2 }}
        >
          The Next Big Thing in{" "}
          <span className="text-teal-400">Medical Sales</span> Is Here.
        </motion.h1>

        <motion.p
          className="text-white/70 text-lg max-w-xl mx-auto mb-10 leading-relaxed"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ delay: 0.35 }}
        >
          HB Medical is seeking elite independent reps to own exclusive
          markets with our breakthrough{" "}
          <span className="text-teal-400 font-semibold">
            Non-Hydrolyzed Collagen
          </span>{" "}
          product — a clinically differentiated solution that sells itself.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ delay: 0.5 }}
        >
          <Link
            href="tel:4042132994"
            className="bg-teal-500 hover:bg-teal-400 text-white font-semibold px-7 py-3.5 rounded-full flex items-center gap-2 transition-colors text-sm shadow-lg shadow-teal-900/40"
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
            Talk to Scottie Today
          </Link>
          <Link
            href="#product"
            className="border border-white/30 hover:border-teal-400/60 text-white hover:text-teal-400 font-semibold px-7 py-3.5 rounded-full flex items-center gap-2 transition-colors text-sm"
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
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            See the Product
          </Link>
        </motion.div>

        <motion.div
          className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl divide-x divide-white/15 flex flex-col sm:flex-row overflow-hidden"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          transition={{ delayChildren: 0.65 }}
        >
          <AnimatedStat target={94} suffix="%" label="Rep Satisfaction" />
          <AnimatedStat target={3} suffix="x" label="Avg. Commission Growth" />
          <AnimatedStat target={50} suffix="+" label="Open Sales Markets" />
        </motion.div>
      </div>
    </section>
  );
}
