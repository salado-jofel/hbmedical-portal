"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { fadeDown } from "@/components/ui/animations";
import { MeridianLogo } from "../(components)/MeridianLogo";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#why-us", label: "Why Us" },
  { href: "#demo", label: "Demo" },
  { href: "#sp-contact", label: "Contact Us" },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm"
        initial="hidden"
        animate="visible"
        variants={fadeDown}
      >
        <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between">

          {/* ── Logo ── */}
          <MeridianLogo variant="light" size="md" />

          {/* ── Desktop Nav Links ── */}
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="hover:text-[var(--navy)] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Desktop CTA Buttons ── */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <CTAButtons onNavigate={closeMenu} />
          </div>

          {/* ── Mobile: Hamburger ── */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <motion.span
              className="block h-0.5 w-5 bg-gray-700 rounded-full origin-center"
              animate={menuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.25 }}
            />
            <motion.span
              className="block h-0.5 w-5 bg-gray-700 rounded-full"
              animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.2 }}
            />
            <motion.span
              className="block h-0.5 w-5 bg-gray-700 rounded-full origin-center"
              animate={menuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.25 }}
            />
          </button>
        </div>

        {/* ── Mobile Dropdown Menu ── */}
        <AnimatePresence initial={false}>
          {menuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="md:hidden overflow-hidden bg-white border-t border-gray-100"
            >
              <div className="px-6 py-4 flex flex-col gap-1">

                {/* Nav Links */}
                {NAV_LINKS.map(({ href, label }, i) => (
                  <motion.div
                    key={href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <Link
                      href={href}
                      onClick={closeMenu}
                      className="block py-2.5 text-sm font-medium text-gray-600 hover:text-[var(--navy)] transition-colors border-b border-gray-100 last:border-0"
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}

                {/* CTA Buttons stacked */}
                <motion.div
                  className="flex flex-col gap-2.5 pt-4"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: NAV_LINKS.length * 0.06 + 0.05 }}
                >
                  <CTAButtons onNavigate={closeMenu} stacked />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── Backdrop (tap to close) ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeMenu}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────────────────────────────
   Shared CTA Buttons (desktop + mobile)
───────────────────────────────────────────── */
function CTAButtons({
  onNavigate,
  stacked = false,
}: {
  onNavigate: () => void;
  stacked?: boolean;
}) {
  return (
    <>
      <Link
        href="#sp-contact"
        onClick={onNavigate}
        className={`bg-[var(--navy)] hover:bg-[#126091] text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center justify-center gap-2 transition-colors ${stacked ? "w-full" : ""
          }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
        Get In Touch
      </Link>

      <Link
        href="/sign-in"
        onClick={onNavigate}
        className={`border border-[var(--navy)]/40 hover:border-[var(--navy)] text-[var(--navy)]/70 hover:text-[var(--navy)] text-sm font-semibold px-4 py-2 rounded-full flex items-center justify-center gap-2 transition-colors ${stacked ? "w-full" : ""
          }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        Portal
      </Link>
    </>
  );
}
