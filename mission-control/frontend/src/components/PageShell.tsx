import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageShell({
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-5 p-4 sm:p-6 overflow-y-auto h-full"
    >
      {children}
    </motion.div>
  );
}
