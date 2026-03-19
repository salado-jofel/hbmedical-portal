"use client";

import { motion } from "framer-motion";
import { VIEWPORT, staggerContainer, fadeUp } from "@/components/ui/animations";
import { FooterLink } from "../(components)/FooterLink";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Why Us", href: "#why-us" },
  { label: "Demo", href: "#demo" },
  { label: "Contact Scottie", href: "#sp-contact" },
];

export function Footer() {
  return (
    <footer className="bg-[#061d28] py-14 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          className="flex flex-col items-center"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={staggerContainer}
        >
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-2 mb-3"
          >
            <div className="w-7 h-7 rounded-full border-2 border-teal-400/60 flex items-center justify-center">
              <span className="text-teal-400 text-xs font-bold">S</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-widest leading-none">
                HB
              </p>
              <p className="text-white/40 text-[9px] tracking-[0.3em] leading-none mt-0.5">
                MEDICAL
              </p>
            </div>
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="text-white/40 text-sm text-center max-w-xs mb-8"
          >
            Empowering independent reps with cutting-edge medical solutions.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex items-center justify-center gap-8 mb-10"
          >
            {navLinks.map((link) => (
              <FooterLink
                key={link.label}
                label={link.label}
                href={link.href}
              />
            ))}
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="border-t border-white/10 pt-8 w-full flex flex-col items-center gap-2"
          >
            <p className="text-white/30 text-xs">
              © 2025 HB Medical. All rights reserved.
            </p>
            <p className="text-white/20 text-xs">
              This page is intended for prospective independent sales
              representatives only.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </footer>
  );
}
