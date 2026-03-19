"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeDown } from "@/components/ui/animations";

export function Navbar() {
  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 bg-[#0a2a35]/90 backdrop-blur-sm border-b border-white/10"
      initial="hidden"
      animate="visible"
      variants={fadeDown}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full border-2 border-teal-400 flex items-center justify-center">
            <span className="text-teal-400 text-xs font-bold">S</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-widest leading-none">
              HB
            </p>
            <p className="text-white/50 text-[9px] tracking-[0.3em] leading-none mt-0.5">
              MEDICAL
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <Link
            href="#product"
            className="hover:text-teal-400 transition-colors"
          >
            Product
          </Link>
          <Link
            href="#why-us"
            className="hover:text-teal-400 transition-colors"
          >
            Why Us
          </Link>
          <Link href="#demo" className="hover:text-teal-400 transition-colors">
            Demo
          </Link>
          <Link
            href="#sp-contact"
            className="hover:text-teal-400 transition-colors"
          >
            Contact Scottie
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="#sp-contact"
            className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-2 transition-colors"
          >
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
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            Get In Touch
          </Link>
          <Link
            href="/sign-in"
            className="border border-white/30 hover:border-white/60 text-white/80 hover:text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-2 transition-colors"
          >
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Portal
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
