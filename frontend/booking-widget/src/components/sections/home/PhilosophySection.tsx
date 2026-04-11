import { motion } from "framer-motion";
import { Eyebrow } from "../../common/Eyebrow";
import { TextReveal } from "../../common/TextReveal";
import { FadeIn } from "../../common/FadeIn";

const BG_IMAGE =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowerinterior2.jpg.jpg";

const PILLARS = [
  {
    index: "01",
    title: "Directo con el operador",
    body:
      "Sin Airbnb, sin intermediarios, sin markups. Reservas con el equipo que construye y mantiene el edificio todos los dias.",
  },
  {
    index: "02",
    title: "Estandar de hotel boutique",
    body:
      "Limpieza diaria opcional, check-in digital 24/7, amenities de edificio, asistencia en tiempo real por WhatsApp.",
  },
  {
    index: "03",
    title: "Ubicaciones imposibles de replicar",
    body:
      "Todos los lofts estan en las mejores zonas de Asuncion. Recoleta, Villa Morra, Las Mercedes, en edificios disenados y operados por nosotros.",
  },
];

export function PhilosophySection() {
  return (
    <section className="relative overflow-hidden bg-charcoal text-cream py-[var(--section-padding-y)]">
      {/* Background image very subtle */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
        <img src={BG_IMAGE} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>

      {/* Vertical gold line */}
      <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gold/30 to-transparent xl:block" />

      <div className="relative pl-container">
        <div className="max-w-3xl">
          <FadeIn>
            <Eyebrow tone="light">Por que reservar directo</Eyebrow>
          </FadeIn>
          <div className="mt-6">
            <TextReveal
              as="h2"
              lines={[
                "No alquilamos un departamento.",
                "Operamos un edificio completo.",
              ]}
              className="font-display text-display font-light text-cream"
            />
          </div>
          <FadeIn delay={0.3}>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-cream/60">
              Parece un matiz. No lo es. Es la diferencia entre quedarte en una lista de Airbnb y
              quedarte en un edificio donde cada detalle esta bajo un mismo estandar.
            </p>
          </FadeIn>
        </div>

        <div className="mt-20 grid gap-10 md:mt-28 md:grid-cols-3 md:gap-14">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1, delay: i * 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="group relative"
            >
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 1.1, delay: i * 0.18 + 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: "left" }}
                className="h-px w-full bg-gold"
              />
              <div className="mt-8 font-display text-5xl font-light leading-none text-gold md:text-6xl">
                {p.index}
              </div>
              <h3 className="mt-6 font-display text-2xl leading-tight text-cream md:text-3xl">
                {p.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-cream/60">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
