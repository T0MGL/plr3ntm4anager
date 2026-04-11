import { Link } from "react-router";
import { motion } from "framer-motion";
import { Eyebrow } from "../../common/Eyebrow";
import { TextReveal } from "../../common/TextReveal";
import { FadeIn } from "../../common/FadeIn";

const BG_IMAGE =
  "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowercafe.jpeg";

export function ContactCTASection() {
  return (
    <section className="relative isolate overflow-hidden bg-charcoal text-cream">
      <div className="absolute inset-0">
        <img src={BG_IMAGE} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="pointer-events-none absolute inset-0 pl-overlay-dark-sharp" />
      <div className="pointer-events-none absolute inset-0 pl-grain" />

      {/* Side gold gradient */}
      <div className="pointer-events-none absolute left-0 top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-gold/40 to-transparent lg:block" />

      <div className="relative pl-container py-[var(--section-padding-y)]">
        <div className="max-w-3xl">
          <FadeIn>
            <Eyebrow tone="light">Reservar</Eyebrow>
          </FadeIn>
          <div className="mt-6">
            <TextReveal
              as="h2"
              lines={["Listo para quedarte.", "Nosotros te esperamos."]}
              className="font-display text-display font-light text-cream"
            />
          </div>
          <FadeIn delay={0.3}>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-cream/65">
              Reserva en menos de tres minutos. Confirmacion instantanea, pago seguro por Bancard,
              asistencia directa por WhatsApp antes, durante y despues de tu estancia.
            </p>
          </FadeIn>
          <FadeIn delay={0.45}>
            <div className="mt-12 flex flex-wrap items-center gap-4">
              <Link to="#lofts" className="pl-btn-light">
                <span>Ver lofts disponibles</span>
              </Link>
              <a
                href="https://wa.me/595981587588"
                target="_blank"
                rel="noopener noreferrer"
                className="pl-btn-light"
              >
                <span>WhatsApp directo</span>
              </a>
            </div>
          </FadeIn>
        </div>

        {/* GPS coordinates decorative */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute bottom-10 right-8 hidden text-right font-mono text-[0.625rem] uppercase tracking-[0.18em] text-cream/30 lg:block"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <div>25.2822 S</div>
          <div>57.6351 W</div>
          <div className="mt-2 text-gold/50">Asuncion, PY</div>
        </motion.div>
      </div>
    </section>
  );
}
