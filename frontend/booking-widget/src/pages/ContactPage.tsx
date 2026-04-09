import { FiClock, FiMail, FiMapPin, FiPhone } from "react-icons/fi";

const CONTACT_CHANNELS = [
  {
    icon: FiMail,
    label: "Correo de reservas",
    value: "reservas@parkloftsparaguay.com",
    href: "mailto:reservas@parkloftsparaguay.com",
  },
  {
    icon: FiPhone,
    label: "WhatsApp",
    value: "+595 981 123 456",
    href: "https://wa.me/595981123456",
  },
  {
    icon: FiMapPin,
    label: "Direccion",
    value: "Av. Mariscal Lopez 3794, Asuncion, Paraguay",
    href: "https://maps.google.com/?q=Park+Lofts+Asuncion",
  },
  {
    icon: FiClock,
    label: "Horario de atencion",
    value: "Lunes a domingo, 08:00 a 22:00 (GMT-3)",
  },
];

export default function ContactPage() {
  return (
    <section className="pl-container py-24">
      <div className="max-w-3xl">
        <span className="pl-gold-rule" />
        <h1 className="mt-6 font-display text-5xl leading-none tracking-tight text-charcoal md:text-6xl">
          Hablemos
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-charcoal-500">
          Estamos disponibles para coordinar tu estancia, resolver consultas y atender pedidos especiales. Escribinos por el canal que prefieras y te respondemos en menos de una hora en horario de atencion.
        </p>
      </div>

      <div className="mt-16 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {CONTACT_CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const content = (
            <div className="group flex items-start gap-5 border-t border-stone pt-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-charcoal/20 text-charcoal transition-all duration-500 group-hover:border-gold group-hover:text-gold">
                <Icon size={16} />
              </div>
              <div>
                <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-charcoal-400">
                  {channel.label}
                </div>
                <div className="mt-2 text-lg text-charcoal">
                  {channel.value}
                </div>
              </div>
            </div>
          );

          if (channel.href) {
            return (
              <a
                key={channel.label}
                href={channel.href}
                target={channel.href.startsWith("http") ? "_blank" : undefined}
                rel={channel.href.startsWith("http") ? "noreferrer" : undefined}
                className="block transition-opacity hover:opacity-80"
              >
                {content}
              </a>
            );
          }

          return <div key={channel.label}>{content}</div>;
        })}
      </div>

      <div className="mt-24 border border-stone bg-cream-50 px-8 py-10 md:px-12 md:py-14">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="text-[0.625rem] uppercase tracking-[0.25em] text-gold">
              Reservas inmediatas
            </div>
            <h2 className="mt-4 font-display text-3xl leading-tight text-charcoal md:text-4xl">
              Elegi tu loft y reserva en minutos
            </h2>
            <p className="mt-4 max-w-md text-sm text-charcoal-500">
              Nuestro sistema procesa pagos seguros via Bancard y confirma la disponibilidad al instante.
            </p>
          </div>
          <a href="/" className="pl-btn-primary whitespace-nowrap">
            Ver lofts
          </a>
        </div>
      </div>
    </section>
  );
}
