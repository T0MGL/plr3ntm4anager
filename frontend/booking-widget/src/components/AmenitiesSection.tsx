import React from "react";

type Amenity = {
  title: string;
  img: string;
  available?: boolean;
};

type Props = {
  title?: string;
  amenities: Amenity[];
  onShowAll?: () => void;
  maxVisible?: number;
};

const AmenitiesSection: React.FC<Props> = ({
  title = "What this place offers",
  amenities,
  onShowAll,
  maxVisible = 10,
}) => {
  const visible = amenities.slice(0, maxVisible);

  return (
    <section className="mt-6">
      <h3 className="text-xl font-semibold">{title}</h3>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-5">
        {visible.map((a, idx) => {
          const available = a.available !== false;

          return (
            <div key={`${a.title}-${idx}`} className="flex items-center gap-4">
              <img
                src={a.img}
                alt={a.title}
                className={`h-6 w-6 object-contain ${
                  available ? "" : "opacity-40"
                }`}
              />

              <p
                className={`text-base ${
                  available
                    ? "text-neutral-900"
                    : "text-neutral-400 line-through"
                }`}
              >
                {a.title}
              </p>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onShowAll}
        className="mt-6 inline-flex items-center justify-center rounded-xl border border-neutral-300 px-5 py-3 text-sm font-semibold hover:bg-neutral-50 active:scale-[0.99]"
      >
        Show all {amenities.length} amenities
      </button>
    </section>
  );
};

export default AmenitiesSection;
