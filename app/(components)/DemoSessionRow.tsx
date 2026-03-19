"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/components/ui/animations";

interface DemoSessionRowProps {
  day: string;
  time: string;
  status: "open" | "limited";
}

export function DemoSessionRow({ day, time, status }: DemoSessionRowProps) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ x: 4 }}
      className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 cursor-default"
    >
      <div>
        <p className="text-white font-semibold text-sm">{day}</p>
        <p className="text-white/50 text-xs mt-0.5">{time}</p>
      </div>

      {status === "open" ? (
        <span className="bg-teal-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          Spots Open
        </span>
      ) : (
        <span className="bg-orange-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          2 Spots Left
        </span>
      )}
    </motion.div>
  );
}
