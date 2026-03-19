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
      className="text-gray-500 hover:text-[#f5a255] text-sm transition-colors"
    >
      {label}
    </Link>
  );
}
