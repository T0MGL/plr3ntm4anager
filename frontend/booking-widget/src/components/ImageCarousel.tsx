import { useEffect, useMemo, useRef, useState } from "react";
import { LeftArrow, RightArrow } from "../assets/icons";

export function ImageCarousel({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const safeImages = useMemo(
    () => (images?.length ? images : ["https://picsum.photos/800/600?blur=1"]),
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

  const SWIPE_THRESHOLD = 50;

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

    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      if (delta > 0 && canNext) {
        setIdx((v) => Math.min(safeImages.length - 1, v + 1));
      } else if (delta < 0 && canPrev) {
        setIdx((v) => Math.max(0, v - 1));
      }
    }

    startX.current = null;
    endX.current = null;
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {safeImages.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt={alt}
            className="h-56 w-full flex-none object-cover sm:h-60"
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
              canPrev && setIdx((v) => Math.max(0, v - 1));
            }}
            className={`absolute z-999 left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-1 py-1 text-sm shadow ${
              canPrev
                ? "hover:bg-white"
                : "disable cursor-not-allowed opacity-60"
            }`}
            aria-label="Previous image"
          >
            <LeftArrow />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              canNext && setIdx((v) => Math.min(safeImages.length - 1, v + 1));
            }}
            className={`absolute z-999 right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/60 px-1 py-1 text-sm shadow ${
              canNext
                ? "hover:bg-white"
                : "disable cursor-not-allowed opacity-60"
            }`}
            aria-label="Next image"
          >
            <RightArrow />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/20 px-2 py-1">
            {safeImages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === idx ? "bg-white" : "bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
