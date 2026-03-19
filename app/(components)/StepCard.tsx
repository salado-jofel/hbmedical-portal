// components/ui/StepCard.tsx
"use client";

import { VIEWPORT } from "@/components/ui/animations";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StepCardProps {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  index: number;
  isLast: boolean;
}

export function StepCard({
  number,
  icon,
  title,
  description,
  index,
  isLast,
}: StepCardProps) {
  return (
    <div className="flex md:flex-col items-start md:items-center gap-4 md:gap-0 flex-1">
      <motion.div
        className="flex flex-col md:items-center md:text-center flex-1"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={{
          hidden: { opacity: 0, y: 40 },
          visible: {
            opacity: 1,
            y: 0,
            transition: {
              duration: 0.55,
              delay: index * 0.15,
              ease: [0.22, 1, 0.36, 1],
            },
          },
        }}
      >
        <p className="text-teal-400/50 text-xs font-bold tracking-widest mb-2">
          {number}
        </p>

        <motion.div
          className="w-14 h-14 rounded-2xl bg-teal-500 text-white flex items-center justify-center shadow-lg shadow-teal-200 mb-4 shrink-0"
          whileHover={{ scale: 1.12, rotate: -6 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          {icon}
        </motion.div>

        <h3 className="font-bold text-gray-900 mb-2 text-base">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed max-w-50">
          {description}
        </p>
      </motion.div>
    </div>
  );
}
