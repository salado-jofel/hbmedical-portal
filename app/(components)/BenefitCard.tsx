// components/ui/BenefitCard.tsx
"use client";

import { motion } from "framer-motion";
import { scaleIn } from "@/components/ui/animations";
import { ReactNode } from "react";

interface BenefitCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  badge: string;
  highlight?: boolean;
}

export function BenefitCard({
  icon,
  title,
  description,
  badge,
  highlight = false,
}: BenefitCardProps) {
  return (
    <motion.div
      variants={scaleIn}
      whileHover={{
        y: -6,
        transition: { duration: 0.25, ease: "easeOut" },
      }}
      className={`relative p-6 rounded-2xl border transition-colors cursor-default ${
        highlight
          ? "bg-teal-500/20 border-teal-400/50 shadow-lg shadow-teal-900/30"
          : "bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/8"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-teal-400 text-teal-950 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      <div className="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center mb-4">
        {icon}
      </div>

      <h3 className="font-bold text-white text-lg mb-2">{title}</h3>

      <p className="text-white/55 text-sm leading-relaxed mb-4">
        {description}
      </p>

      <span className="inline-block bg-white/10 text-white/70 text-xs font-semibold tracking-wider uppercase px-3 py-1 rounded-full">
        {badge}
      </span>
    </motion.div>
  );
}
