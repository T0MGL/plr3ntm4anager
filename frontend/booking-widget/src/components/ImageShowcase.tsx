import React, { useMemo, useState } from "react";

type ImageShowcaseProps = {
  images: string[];
  alt?: string;
  onShowAll?: () => void;
};

function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
    </svg>
  );
}

export default function ImageShowcase({
  images,
  alt = "Photo",
  onShowAll,
}: ImageShowcaseProps) {
  const safeImages = useMemo(
    () => (images?.length ? images : ["https://picsum.photos/1600/900?blur=1"]),
    [images],
  );

  const main = safeImages[0];
  const thumbs = [
    safeImages[1],
    safeImages[2],
    safeImages[3],
    safeImages[4],
  ].map((x) => x ?? main);

  const useInternalModal = !onShowAll;
  const [open, setOpen] = useState(false);

  const handleShowAll = () => {
    if (useInternalModal) setOpen(true);
    onShowAll?.();
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <button
            type="button"
            className="group relative h-[260px] w-full overflow-hidden md:h-[420px]"
            onClick={handleShowAll}
            aria-label="Open photos"
          >
            <img
              src={main}
              alt={alt}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              draggable={false}
            />
          </button>

          <div className="grid grid-cols-2 gap-2">
            {thumbs.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                className={`group relative h-[125px] w-full overflow-hidden md:h-[206px]
        ${i >= 2 ? "hidden md:block" : ""}
      `}
                onClick={handleShowAll}
                aria-label={`Open photo ${i + 2}`}
              >
                <img
                  src={src}
                  alt={`${alt} ${i + 2}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="absolute bottom-4 right-4">
          <button
            type="button"
            onClick={handleShowAll}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 shadow hover:bg-neutral-50"
          >
            <GridIcon />
            Show all photos
          </button>
        </div>
      </div>

      {useInternalModal && open && (
        <div
          className="fixed inset-0 z-50 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-label="All photos"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="mx-auto flex h-full max-w-6xl flex-col bg-white">
            <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
              <div className="text-sm font-semibold">All photos</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-1 text-sm hover:bg-neutral-100"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {safeImages.map((src, i) => (
                  <img
                    key={`${src}-${i}`}
                    src={src}
                    alt={`${alt} ${i + 1}`}
                    className="h-56 w-full rounded-xl object-cover"
                    draggable={false}
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
