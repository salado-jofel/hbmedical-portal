"use client";

import { VIEWPORT, badgePop, fadeUp, scaleIn, staggerContainer } from "@/components/ui/animations";
import { motion } from "framer-motion";

export function Contact() {
  return (
    <section id="sp-contact" className="py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-3xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          className="flex justify-center mb-6"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={badgePop}
        >
          <span className="bg-[#15689E]/10 text-[#15689E] text-xs font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full border border-[#15689E]/20">
            Ready to Get Started?
          </span>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={fadeUp}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Talk Directly to{" "}
            <span className="text-[#f5a255]">Scottie Jennings</span>
          </h2>
          <p className="text-gray-500 mb-12 text-lg leading-relaxed">
            No forms. No gatekeepers. Call or text Scottie directly — he&apos;ll
            answer your questions and get you set up fast.
          </p>
        </motion.div>

        {/* Contact Card */}
        <motion.div
          className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 max-w-lg mx-auto text-left"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={scaleIn}
        >
          <div className="mb-1">
            <h3 className="text-2xl font-bold text-gray-900">
              Scottie Jennings
            </h3>
            <span className="text-[#15689E] text-xs font-bold tracking-widest uppercase">
              HB Medical — Rep Partnerships
            </span>
          </div>

          <p className="text-gray-500 text-sm leading-relaxed mt-3 mb-6">
            Scottie works directly with independent medical sales reps to find
            the right fit, answer every question, and get you into the field
            fast. Reach out anytime — he picks up.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            <motion.a
              href="tel:4042132994"
              className="flex items-center justify-center gap-2 bg-[#15689E] hover:bg-[#0f4f7a] text-white font-semibold py-3.5 px-5 rounded-xl transition-colors"
              whileHover={{ scale: 1.03 }}
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
              <div>
                <p className="text-xs opacity-80 leading-none mb-0.5">
                  Call Scottie
                </p>
                <p className="font-bold text-sm">(404) 213-2994</p>
              </div>
            </motion.a>

            <motion.a
              href="sms:4042132994"
              className="flex items-center justify-center gap-2 border border-gray-200 hover:border-[#15689E]/40 text-gray-700 hover:text-[#15689E] font-semibold py-3.5 px-5 rounded-xl transition-colors bg-white"
              whileHover={{ scale: 1.03 }}
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
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 11.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <div>
                <p className="text-xs opacity-60 leading-none mb-0.5">
                  Text Scottie
                </p>
                <p className="font-bold text-sm">(404) 213-2994</p>
              </div>
            </motion.a>
          </div>

          {/* Trust Points */}
          <motion.div
            className="space-y-2"
            initial="hidden"
            whileInView="visible"
            viewport={VIEWPORT}
            variants={staggerContainer}
          >
            {[
              "No buy-in or franchise fees",
              "Protected sales markets available now",
              "Zero pressure — just an honest conversation",
              "Get in the field within 5 days of your first call",
            ].map((point) => (
              <motion.div
                key={point}
                variants={fadeUp}
                className="flex items-center gap-2 text-gray-600 text-sm"
              >
                <svg
                  className="w-4 h-4 text-[#f5a255] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {point}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
