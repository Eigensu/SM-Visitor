import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className, hover = false, onClick }: GlassCardProps) {
  const Component = hover ? motion.div : "div";

  return (
    <Component
      className={cn(
        "rounded-xl border border-border/50 bg-card/80 p-5 shadow-md backdrop-blur-xl",
        hover &&
          "cursor-pointer transition-all duration-300 ease-out hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      {...(hover && {
        whileHover: { y: -2, scale: 1.01 },
        whileTap: { scale: 0.99 },
      })}
    >
      {children}
    </Component>
  );
}
