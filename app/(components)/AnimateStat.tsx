import { fadeUp } from "@/components/ui/animations";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export function AnimatedStat({
  target,
  suffix,
  label,
}: {
  target: number;
  suffix: string;
  label: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col items-center px-6 py-4 justify-center w-full"
    >
      <span className="text-3xl font-bold text-white">
        {count}
        <span className="text-teal-400">{suffix}</span>
      </span>
      <span className="text-white/50 text-xs tracking-widest uppercase mt-1">
        {label}
      </span>
    </motion.div>
  );
}
