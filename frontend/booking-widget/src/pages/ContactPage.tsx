import { FiClock, FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import type { IconType } from "react-icons";

type ContactChannel = {
  icon: IconType;
  labelKey: string;
  valueKey?: string;
  value?: string;
  href?: string;
};

const CONTACT_CHANNELS: ContactChannel[] = [
  {
    icon: FiMail,
    labelKey: "contact.channels.email",
    value: "reservas@parkloftsparaguay.com",
    href: "mailto:reservas@parkloftsparaguay.com",
  },
  {
    icon: FiPhone,
    labelKey: "contact.channels.whatsapp",
    value: "+595 981 123 456",
    href: "https://wa.me/595981123456",
  },
  {
    icon: FiMapPin,
    labelKey: "contact.channels.address",
    valueKey: "contact.channels.addressValue",
    href: "https://maps.google.com/?q=Park+Lofts+Asuncion",
  },
  {
    icon: FiClock,
    labelKey: "contact.channels.hours",
    valueKey: "contact.channels.hoursValue",
  },
];

export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <section className="pl-container py-24">
      <div className="max-w-3xl">
        <span className="pl-gold-rule" />
        <h1 className="mt-6 font-display text-5xl leading-none tracking-tight text-charcoal md:text-6xl">
          {t("contact.heading")}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-charcoal-500">
          {t("contact.intro")}
        </p>
      </div>

      <div className="mt-16 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {CONTACT_CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const label = t(channel.labelKey);
          const value = channel.valueKey ? t(channel.valueKey) : channel.value ?? "";
          const content = (
            <div className="group flex items-start gap-5 border-t border-stone pt-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-charcoal/20 text-charcoal transition-all duration-500 group-hover:border-gold group-hover:text-gold">
                <Icon size={16} />
              </div>
              <div>
                <div className="text-[0.625rem] font-medium uppercase tracking-[0.25em] text-charcoal-400">
                  {label}
                </div>
                <div className="mt-2 text-lg text-charcoal">{value}</div>
              </div>
            </div>
          );

          if (channel.href) {
            return (
              <a
                key={channel.labelKey}
                href={channel.href}
                target={channel.href.startsWith("http") ? "_blank" : undefined}
                rel={channel.href.startsWith("http") ? "noreferrer" : undefined}
                className="block transition-opacity hover:opacity-80"
              >
                {content}
              </a>
            );
          }

          return <div key={channel.labelKey}>{content}</div>;
        })}
      </div>

      <div className="mt-24 border border-stone bg-cream-50 px-8 py-10 md:px-12 md:py-14">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="text-[0.625rem] uppercase tracking-[0.25em] text-gold">
              {t("contact.cta.eyebrow")}
            </div>
            <h2 className="mt-4 font-display text-3xl leading-tight text-charcoal md:text-4xl">
              {t("contact.cta.title")}
            </h2>
            <p className="mt-4 max-w-md text-sm text-charcoal-500">
              {t("contact.cta.body")}
            </p>
          </div>
          <a href="/" className="pl-btn-primary whitespace-nowrap">
            {t("contact.cta.button")}
          </a>
        </div>
      </div>
    </section>
  );
}
