import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAnimatedMount } from "../hooks/useAnimatedMount";

type AmenityItem = {
  title: string;
  img: string;
  available?: boolean;
};

type AmenitySection = {
  heading: string;
  items: AmenityItem[];
};

type TextSection = {
  heading?: string;
  subheading?: string;
  paragraphs: string[];
};

type BaseProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  durationMs?: number;
};

type AmenitiesProps = BaseProps & {
  mode: "amenities";
  sections: AmenitySection[];
};

type TextProps = BaseProps & {
  mode: "text";
  sections: TextSection[];
};

type DynamicModalProps = AmenitiesProps | TextProps;

const DynamicModal: React.FC<DynamicModalProps> = (props) => {
  const { t } = useTranslation();
  const { open, onClose, title, description, durationMs = 220 } = props;
  const mounted = useAnimatedMount(open, durationMs);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className={[
          "absolute inset-0 bg-black transition-opacity",
          open ? "opacity-40" : "opacity-0",
        ].join(" ")}
        style={{ transitionDuration: `${durationMs}ms` }}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={[
            "w-full max-w-4xl rounded-[28px] bg-white shadow-xl overflow-hidden",
            "transform transition-all",
            open
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-2 scale-[0.98]",
          ].join(" ")}
          style={{ transitionDuration: `${durationMs}ms` }}
        >
          <div className="relative px-10 pt-8 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-6 top-6 rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              aria-label={t("common.close")}
            >
              {t("common.close")}
            </button>

            <h2 className="text-3xl font-semibold">{title}</h2>

            {description ? (
              <p className="mt-2 text-sm text-neutral-600">{description}</p>
            ) : null}
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-10 pb-10">
            {props.mode === "amenities" ? (
              <AmenitiesBody sections={props.sections} />
            ) : (
              <TextBody sections={props.sections} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function AmenitiesBody({ sections }: { sections: AmenitySection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section, sIdx) => (
        <div key={`${section.heading}-${sIdx}`}>
          <h3 className="text-lg font-semibold">{section.heading}</h3>

          <div className="mt-3">
            {section.items.map((item, iIdx) => {
              const available = item.available !== false;

              return (
                <div
                  key={`${item.title}-${iIdx}`}
                  className="flex items-center gap-4 py-4 border-b border-neutral-200"
                >
                  <img
                    src={item.img}
                    alt={item.title}
                    className={`h-6 w-6 object-contain ${available ? "" : "opacity-40"}`}
                  />
                  <p
                    className={`text-base ${
                      available
                        ? "text-neutral-900"
                        : "text-neutral-400 line-through"
                    }`}
                  >
                    {item.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TextBody({ sections }: { sections: TextSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          {section.heading && (
            <h3 className="text-base font-semibold text-neutral-900">
              {section.heading}
            </h3>
          )}
          {section.subheading && (
            <p className="mt-1 text-base text-neutral-700">
              {section.subheading}
            </p>
          )}

          <div className="mt-6 space-y-6">
            {section.paragraphs.map((p, pIdx) => (
              <p key={pIdx} className="text-base leading-7 text-neutral-800">
                {p}
              </p>
            ))}
          </div>

          {sIdx !== sections.length - 1 && (
            <hr className="mt-10 border-neutral-200" />
          )}
        </div>
      ))}
    </div>
  );
}

export default DynamicModal;
