import { useEffect, useMemo, useRef, useState } from "react";
import { LeftArrow, RightArrow } from "../assets/icons";

// Carousel that fills its parent. The previous version hard-coded `h-56`
// on each image, so whatever aspect ratio the parent wanted was ignored
// and cards ended up with half-rendered pictures. Now the root is
// `absolute inset-0` and images use `h-full object-cover`, so the parent
// decides the shape via its own aspect-ratio utility.

export function ImageCarousel({
  images,
  alt,
  rounded = true,
}: {
  images: string[];
  alt: string;
  rounded?: boolean;
}) {
  const safeImages = useMemo(
    () =>
      images?.length
        ? images
        : [
            "https://pub-70473ebb629c4efb93b99bf2e83117da.r2.dev/projects/tower/parkloftstowerlobby.jpeg",
          ],
    [images],
  );

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx((v) => Math.min(v, safeImages.length - 1));
  }, [safeImages.length]);

  const canPrev = idx > 0;
  const canNext = idx < safeImages.length - 1;

  const startX = useRef<number | null>(null);
  const endX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    startX.current = e.touches[0]?.clientX ?? null;
    endX.current = null;
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    endX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = () => {
    if (startX.current == null || endX.current == null) return;
    const delta = startX.current - endX.current;
    if (Math.abs(delta) > 50) {
      if (delta > 0 && canNext) setIdx((v) => Math.min(safeImages.length - 1, v + 1));
      else if (delta < 0 && canPrev) setIdx((v) => Math.max(0, v - 1));
    }
    startX.current = null;
    endX.current = null;
  };

  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-stone touch-pan-y ${
        rounded ? "" : ""
      }`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {safeImages.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={alt}
            className="h-full w-full flex-none object-cover"
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
          />
        ))}
      </div>

      {safeImages.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canPrev) setIdx((v) => Math.max(0, v - 1));
            }}
            disabled={!canPrev}
            className={`absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-cream/40 bg-cream/80 text-charcoal backdrop-blur transition-all duration-300 hover:bg-cream disabled:opacity-0 disabled:pointer-events-none`}
            aria-label="Imagen anterior"
          >
            <LeftArrow />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (canNext) setIdx((v) => Math.min(safeImages.length - 1, v + 1));
            }}
            disabled={!canNext}
            className={`absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-cream/40 bg-cream/80 text-charcoal backdrop-blur transition-all duration-300 hover:bg-cream disabled:opacity-0 disabled:pointer-events-none`}
            aria-label="Siguiente imagen"
          >
            <RightArrow />
          </button>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
            {safeImages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIdx(i);
                }}
                className={`h-1 rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  i === idx ? "w-6 bg-cream" : "w-1 bg-cream/50"
                }`}
                aria-label={`Ir a la imagen ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
