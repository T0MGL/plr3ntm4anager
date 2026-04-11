import { motion, useReducedMotion } from "framer-motion";

type TextRevealProps = {
  lines: string[];
  className?: string;
  delay?: number;
  stagger?: number;
  as?: "h1" | "h2" | "h3" | "p";
};

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function TextReveal({
  lines,
  className = "",
  delay = 0,
  stagger = 0.12,
  as = "h1",
}: TextRevealProps) {
  const reduce = useReducedMotion();
  const Tag = as as keyof JSX.IntrinsicElements;

  if (reduce) {
    return (
      <Tag className={className}>
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </Tag>
    );
  }

  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span
          key={i}
          className="block overflow-hidden pb-[0.12em] -mb-[0.12em]"
          aria-hidden={false}
        >
          <motion.span
            className="block"
            initial={{ y: "110%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{
              duration: 1,
              delay: delay + i * stagger,
              ease: EXPO_OUT,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
