import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={`glass-panel p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}
