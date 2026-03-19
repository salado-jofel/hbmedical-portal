"use client";

import { motion } from "framer-motion";
import { VIEWPORT, staggerContainer, fadeUp } from "@/components/ui/animations";
import { FooterLink } from "../(components)/FooterLink";
import { HBLogo } from "../(components)/HBLogo";

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Why Us", href: "#why-us" },
  { label: "Demo", href: "#demo" },
  { label: "Contact Scottie", href: "#sp-contact" },
];

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-14 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          className="flex flex-col items-center"
          initial="hidden"
          whileInView="visible"
          viewport={VIEWPORT}
          variants={staggerContainer}
        >
          {/* ── Logo ── */}
          <motion.div variants={fadeUp} className="mb-4">
            <HBLogo variant="light" size="md" />
          </motion.div>

          {/* ── Tagline ── */}
          <motion.p
            variants={fadeUp}
            className="text-gray-400 text-sm text-center max-w-xs mb-8"
          >
            Empowering independent reps with cutting-edge medical solutions.
          </motion.p>

          {/* ── Nav links ── */}
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

          {/* ── Bottom bar ── */}
          <motion.div
            variants={fadeUp}
            className="border-t border-gray-200 pt-8 w-full flex flex-col items-center gap-2"
          >
            <p className="text-gray-400 text-xs">
              © 2025 HB Medical. All rights reserved.
            </p>
            <p className="text-gray-300 text-xs">
              This page is intended for prospective independent sales
              representatives only.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </footer>
  );
}
