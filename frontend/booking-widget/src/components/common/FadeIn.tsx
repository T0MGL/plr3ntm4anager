import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type FadeInProps = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  once?: boolean;
  className?: string;
  as?: "div" | "span" | "section" | "article" | "li";
};

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function FadeIn({
  children,
  delay = 0,
  duration = 0.9,
  y = 24,
  once = true,
  className,
  as = "div",
}: FadeInProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.3 }}
      transition={{ duration, delay, ease: EXPO_OUT }}
    >
      {children}
    </MotionTag>
  );
}
