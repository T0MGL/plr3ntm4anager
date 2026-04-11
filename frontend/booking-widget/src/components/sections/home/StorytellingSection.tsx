import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Eyebrow } from "../../common/Eyebrow";
import { TextReveal } from "../../common/TextReveal";
import { FadeIn } from "../../common/FadeIn";

const STORY_IMAGE =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowerlobby.jpeg";

const STATS = [
  { value: 5, suffix: "", label: "Proyectos del grupo Park Lofts" },
  { value: 350, suffix: "+", label: "Unidades bajo operacion" },
  { value: 0, suffix: "", label: "Intermediarios en tu reserva" },
];

export function StorytellingSection() {
  return (
    <section className="relative bg-cream py-[var(--section-padding-y)]">
      <div className="pl-container">
        <div className="grid gap-14 md:grid-cols-12 md:gap-16">
          {/* Left: narrative */}
          <div className="md:col-span-7">
            <FadeIn>
              <Eyebrow>La operacion</Eyebrow>
            </FadeIn>

            <div className="mt-6">
              <TextReveal
                as="h2"
                lines={[
                  "Un edificio.",
                  "Una filosofia.",
                  "La misma estancia",
                  "en cada reserva.",
                ]}
                className="font-display text-display font-light text-charcoal"
              />
            </div>

            <FadeIn delay={0.3}>
              <div className="mt-10 max-w-xl space-y-5 text-base leading-relaxed text-charcoal-500">
                <p>
                  Park Lofts es el grupo detras de los desarrollos mas ambiciosos de Asuncion:
                  Tower, Recoleta, Airport, Los Arboles. Cada metro cuadrado lo disenamos,
                  construimos y operamos nosotros.
                </p>
                <p>
                  Cuando reservas en Park Lofts Rent no estas alquilando un departamento de un
                  tercero. Estas reservando con el mismo equipo que pensa cada detalle del edificio.
                </p>
              </div>
            </FadeIn>
          </div>

          {/* Right: stats */}
          <div className="md:col-span-5">
            <FadeIn delay={0.15}>
              <div className="border-t border-stone pt-10 md:border-l md:border-t-0 md:pl-10 md:pt-0">
                <div className="space-y-10">
                  {STATS.map((s, i) => (
                    <StatRow key={s.label} value={s.value} suffix={s.suffix} label={s.label} delay={0.2 + i * 0.15} />
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* Full-bleed editorial image */}
      <div className="relative mt-[var(--section-padding-y)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-cream via-cream/60 to-transparent" />
        <div className="relative aspect-[16/7] w-full overflow-hidden bg-stone md:aspect-[21/8]">
          <motion.img
            src={STORY_IMAGE}
            alt="Interior Park Lofts Tower"
            initial={{ scale: 1.08, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

function StatRow({
  value,
  suffix,
  label,
  delay,
}: {
  value: number;
  suffix: string;
  label: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [current, setCurrent] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) {
      if (reduce) setCurrent(value);
      return;
    }
    const duration = 1600;
    const startTime = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const progress = Math.min((t - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCurrent(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-baseline justify-between gap-6 border-b border-stone pb-8 last:border-b-0 last:pb-0"
    >
      <div className="font-display text-5xl font-light leading-none text-charcoal md:text-6xl">
        {current}
        {suffix}
      </div>
      <div className="max-w-[10rem] text-right text-[0.6875rem] uppercase tracking-[0.18em] text-charcoal-500">
        {label}
      </div>
    </motion.div>
  );
}
