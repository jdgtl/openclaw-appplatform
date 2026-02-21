import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  delay = 0,
  accentColor,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  accentColor?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={`bg-card-bg border border-border rounded-xl p-5 transition-all duration-200 ${className}`}
      style={accentColor ? { ["--hover-border" as string]: accentColor } : undefined}
      onMouseEnter={(e) => {
        if (accentColor) {
          (e.currentTarget as HTMLElement).style.borderColor = `${accentColor}44`;
        }
      }}
      onMouseLeave={(e) => {
        if (accentColor) {
          (e.currentTarget as HTMLElement).style.borderColor = "";
        }
      }}
    >
      {children}
    </motion.div>
  );
}
