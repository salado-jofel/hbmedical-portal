"use client";

import { motion } from "framer-motion";
import { fadeRight } from "@/components/ui/animations";
import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <motion.div
      variants={fadeRight}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
      className="flex items-start gap-4 p-5 rounded-xl border border-gray-100 hover:border-teal-200 hover:shadow-sm bg-white transition-shadow cursor-default"
    >
      <div className="shrink-0 w-10 h-10 rounded-lg bg-teal-50 text-teal-500 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
