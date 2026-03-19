"use client";

import Link from "next/link";

interface FooterLinkProps {
  label: string;
  href: string;
}

export function FooterLink({ label, href }: FooterLinkProps) {
  return (
    <Link
      href={href}
      className="text-white/50 hover:text-teal-400 text-sm transition-colors"
    >
      {label}
    </Link>
  );
}
