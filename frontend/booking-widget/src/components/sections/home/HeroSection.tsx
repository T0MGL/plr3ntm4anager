import { useRef } from "react";
import { Link } from "react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Eyebrow } from "../../common/Eyebrow";
import { TextReveal } from "../../common/TextReveal";

const HERO_IMAGE =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/assets/parkloftsrecoletbackground.jpg";

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const META = [
  { label: "Ubicacion", value: "Asuncion, Paraguay" },
  { label: "Check-in", value: "24 / 7 digital" },
  { label: "Pagos", value: "Seguros Bancard" },
];

export function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-10%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-[100svh] w-full items-end overflow-hidden bg-charcoal"
      aria-label="Portada"
    >
      {/* Parallax background image */}
      <motion.div style={{ y: imageY }} className="absolute inset-0 z-0">
        <img
          src={HERO_IMAGE}
          alt=""
          className="h-full w-full object-cover"
          fetchPriority="high"
        />
      </motion.div>

      {/* Overlays */}
      <div className="pointer-events-none absolute inset-0 z-10 pl-overlay-dark" />
      <div className="pointer-events-none absolute inset-0 z-10 pl-overlay-vignette" />
      <div className="pointer-events-none absolute inset-0 z-10 pl-grain" />

      {/* Side decorative line */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 hidden h-full w-px bg-gradient-to-b from-transparent via-gold/25 to-transparent lg:block" />

      {/* Content */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-20 w-full pb-24 md:pb-32"
      >
        <div className="pl-container">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: EXPO_OUT }}
          >
            <Eyebrow tone="light">Park Lofts Rent</Eyebrow>
          </motion.div>

          <div className="mt-8 max-w-5xl">
            <TextReveal
              as="h1"
              lines={[
                "Tu estancia en",
                "el corazon de Asuncion.",
              ]}
              className="font-display text-hero font-light text-cream"
              delay={0.5}
              stagger={0.14}
            />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.1, ease: EXPO_OUT }}
            className="mt-10 max-w-xl text-base leading-relaxed text-cream/75 md:text-lg"
          >
            Lofts de autor operados directamente por Park Lofts, el desarrollador detras de los
            edificios mas reconocidos de Paraguay. Estadias cortas con estandar de hotel boutique.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.3, ease: EXPO_OUT }}
            className="mt-12 flex flex-wrap items-center gap-4"
          >
            <Link to="#lofts" className="pl-btn-light">
              <span>Ver lofts disponibles</span>
            </Link>
            <Link to="/contacto" className="pl-btn-light">
              <span>Hablar con el equipo</span>
            </Link>
          </motion.div>

          {/* Meta bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 1.6, ease: EXPO_OUT }}
            className="mt-20 hidden max-w-3xl grid-cols-3 gap-10 border-t border-cream/15 pt-8 md:grid"
          >
            {META.map((m) => (
              <div key={m.label}>
                <div className="text-[0.625rem] font-medium uppercase tracking-[0.22em] text-gold-light">
                  {m.label}
                </div>
                <div className="mt-2 text-sm text-cream">{m.value}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2, ease: EXPO_OUT }}
        className="absolute bottom-8 left-1/2 z-20 hidden -translate-x-1/2 md:flex"
      >
        <div className="flex flex-col items-center gap-3 text-[0.625rem] font-medium uppercase tracking-[0.3em] text-cream/60">
          Scroll
          <motion.span
            animate={{ y: [0, 8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="h-10 w-px bg-cream/50"
          />
        </div>
      </motion.div>
    </section>
  );
}
