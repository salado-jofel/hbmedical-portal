"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/components/ui/animations";

interface DemoTopicItemProps {
  topic: string;
}

export function DemoTopicItem({ topic }: DemoTopicItemProps) {
  return (
    <motion.li
      variants={fadeUp}
      className="flex items-center gap-3 text-white/75 text-sm"
    >
      <span className="shrink-0 w-5 h-5 rounded-full bg-teal-500/30 border border-teal-400/50 flex items-center justify-center">
        <svg
          className="w-3 h-3 text-teal-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </span>
      {topic}
    </motion.li>
  );
}
