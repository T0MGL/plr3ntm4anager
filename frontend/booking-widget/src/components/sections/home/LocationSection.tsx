import { motion } from "framer-motion";
import { Eyebrow } from "../../common/Eyebrow";
import { TextReveal } from "../../common/TextReveal";
import { FadeIn } from "../../common/FadeIn";

const NEIGHBOURHOODS = [
  { name: "Recoleta", detail: "Flagship tower, 27 pisos, vista 360", x: 55, y: 42 },
  { name: "Villa Morra", detail: "Comercial premium, cafes, boutiques", x: 68, y: 58 },
  { name: "Las Mercedes", detail: "Financial district, corporativo", x: 44, y: 50 },
  { name: "Airport", detail: "12 min al Silvio Pettirossi", x: 80, y: 28 },
];

export function LocationSection() {
  return (
    <section className="relative bg-cream py-[var(--section-padding-y)]">
      <div className="pl-container">
        <div className="grid gap-16 md:grid-cols-12 md:gap-20">
          {/* Left: map */}
          <div className="order-2 md:order-1 md:col-span-7">
            <FadeIn>
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream-50">
                <MapBackground />
                {NEIGHBOURHOODS.map((n, i) => (
                  <Pin key={n.name} neighbourhood={n} index={i} />
                ))}
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="mt-6 flex flex-wrap items-center gap-6 text-[0.625rem] uppercase tracking-[0.22em] text-charcoal-400">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  Park Lofts ubicaciones
                </span>
                <span>-25.2822 S, -57.6351 W</span>
              </div>
            </FadeIn>
          </div>

          {/* Right: copy */}
          <div className="order-1 md:order-2 md:col-span-5">
            <FadeIn>
              <Eyebrow>Ubicacion</Eyebrow>
            </FadeIn>
            <div className="mt-6">
              <TextReveal
                as="h2"
                lines={["Asuncion, sin compromisos."]}
                className="font-display text-display font-light text-charcoal"
              />
            </div>
            <FadeIn delay={0.2}>
              <p className="mt-8 text-base leading-relaxed text-charcoal-500">
                Todos nuestros lofts estan en las cuatro zonas que realmente importan para
                visitantes: Recoleta para pasear, Villa Morra para salir, Las Mercedes para
                trabajar, Airport para entrar y salir rapido.
              </p>
            </FadeIn>
            <FadeIn delay={0.35}>
              <div className="mt-10 space-y-5 border-t border-stone pt-10">
                {NEIGHBOURHOODS.map((n) => (
                  <div key={n.name} className="flex items-baseline justify-between gap-6">
                    <div>
                      <div className="font-display text-xl text-charcoal">{n.name}</div>
                      <div className="mt-1 text-xs text-charcoal-500">{n.detail}</div>
                    </div>
                    <span className="h-px w-8 bg-gold" />
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}

function MapBackground() {
  return (
    <svg
      viewBox="0 0 100 75"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="100" height="75" fill="#FDFBF8" />

      {/* Rio Paraguay abstract ribbon */}
      <path
        d="M 0 58 Q 20 55, 32 62 T 62 64 T 100 60 L 100 75 L 0 75 Z"
        fill="#EDE5D8"
        opacity="0.7"
      />

      {/* Horizontal grid lines */}
      {[15, 30, 45, 60].map((y) => (
        <line
          key={`h-${y}`}
          x1="0"
          y1={y}
          x2="100"
          y2={y}
          stroke="#E2DDD4"
          strokeWidth="0.1"
          strokeDasharray="0.5 1"
        />
      ))}

      {/* Vertical grid lines */}
      {[20, 40, 60, 80].map((x) => (
        <line
          key={`v-${x}`}
          x1={x}
          y1="0"
          x2={x}
          y2="75"
          stroke="#E2DDD4"
          strokeWidth="0.1"
          strokeDasharray="0.5 1"
        />
      ))}

      {/* Roads, suggestive */}
      <path
        d="M 10 20 L 35 38 L 60 45 L 85 40"
        stroke="#C8C2B6"
        strokeWidth="0.4"
        fill="none"
      />
      <path
        d="M 25 10 L 42 30 L 55 55 L 65 70"
        stroke="#C8C2B6"
        strokeWidth="0.4"
        fill="none"
      />

      {/* City label */}
      <text
        x="10"
        y="14"
        fontSize="2"
        fontFamily="DM Sans, sans-serif"
        fontWeight="500"
        letterSpacing="0.4"
        fill="#8A8A8A"
      >
        ASUNCION
      </text>
      <text
        x="10"
        y="17"
        fontSize="1.3"
        fontFamily="DM Sans, sans-serif"
        letterSpacing="0.25"
        fill="#A0A0A0"
      >
        PARAGUAY
      </text>
    </svg>
  );
}

function Pin({
  neighbourhood,
  index,
}: {
  neighbourhood: { name: string; x: number; y: number };
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, delay: 0.3 + index * 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${neighbourhood.x}%`, top: `${neighbourhood.y}%` }}
    >
      <span className="relative flex h-3 w-3 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
      </span>
      <span className="mt-2 whitespace-nowrap text-[0.5625rem] font-medium uppercase tracking-[0.2em] text-charcoal-500">
        {neighbourhood.name}
      </span>
    </motion.div>
  );
}
