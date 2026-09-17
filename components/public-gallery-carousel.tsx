"use client";

import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BusinessGalleryImage } from "@/lib/citadely-db";

type PublicGalleryCarouselProps = {
  businessName: string;
  compact?: boolean;
  images: BusinessGalleryImage[];
};

export function PublicGalleryCarousel({ businessName, compact = false, images }: PublicGalleryCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const touchStartX = useRef<number | null>(null);
  const safeIndex = Math.min(activeIndex, Math.max(images.length - 1, 0));
  const activeImage = images[safeIndex];
  const hasMultipleImages = images.length > 1;
  const titleId = compact ? "galeria-vista-previa-titulo" : "galeria-titulo";
  const Heading = compact ? "h3" : "h2";

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function selectImage(index: number) {
    setActiveIndex(index);
    window.requestAnimationFrame(() => {
      thumbnailRefs.current[index]?.scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  }

  function move(direction: -1 | 1) {
    const nextIndex = (safeIndex + direction + images.length) % images.length;
    selectImage(nextIndex);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!hasMultipleImages) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!hasMultipleImages || touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const distance = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 48) return;
    move(distance > 0 ? -1 : 1);
  }

  if (!activeImage) return null;

  return (
    <section aria-labelledby={titleId} className={`border-b border-[var(--color-line)] bg-white ${compact ? "px-6 py-8 sm:px-9" : "py-10 sm:py-14"}`}>
      <div className={compact ? "" : "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"}>
        <Heading className={`font-display font-semibold tracking-[-0.035em] ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`} id={titleId}>Galería</Heading>
        {!compact ? <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Conocé nuestro espacio y trabajo.</p> : null}

        <div
          aria-label={`Galería de ${businessName}. Usá las flechas izquierda y derecha para cambiar de imagen.`}
          aria-roledescription="carrusel"
          className={`group relative mt-6 overflow-hidden border border-[var(--color-line)] bg-[var(--color-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--booking-brand)] ${compact ? "aspect-[4/3]" : "aspect-[4/3] sm:aspect-[16/9]"}`}
          onKeyDown={handleKeyDown}
          onTouchEnd={handleTouchEnd}
          onTouchStart={handleTouchStart}
          role="region"
          tabIndex={0}
        >
          <span
            aria-label={`${businessName}, imagen ${safeIndex + 1} de ${images.length}`}
            className="absolute inset-0 bg-contain bg-center bg-no-repeat"
            role="img"
            style={{ backgroundImage: `url(${activeImage.image_url})` }}
          />

          {hasMultipleImages ? (
            <>
              <button
                aria-label="Ver imagen anterior"
                className={`absolute left-3 top-1/2 grid -translate-y-1/2 cursor-pointer place-items-center rounded-md border border-[var(--color-line)] bg-white/95 text-[var(--color-navy)] shadow-md transition-colors hover:border-[var(--booking-brand)] hover:text-[var(--booking-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--booking-brand)] ${compact ? "h-11 w-11" : "h-12 w-12 sm:left-4"}`}
                onClick={() => move(-1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={compact ? 20 : 22} />
              </button>
              <button
                aria-label="Ver imagen siguiente"
                className={`absolute right-3 top-1/2 grid -translate-y-1/2 cursor-pointer place-items-center rounded-md border border-[var(--color-line)] bg-white/95 text-[var(--color-navy)] shadow-md transition-colors hover:border-[var(--booking-brand)] hover:text-[var(--booking-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--booking-brand)] ${compact ? "h-11 w-11" : "h-12 w-12 sm:right-4"}`}
                onClick={() => move(1)}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={compact ? 20 : 22} />
              </button>
              <span className="absolute bottom-3 right-3 rounded-md bg-[var(--color-navy)] px-2.5 py-1.5 font-mono text-xs font-semibold tabular-nums text-white sm:bottom-4 sm:right-4">
                {safeIndex + 1} / {images.length}
              </span>
            </>
          ) : null}
        </div>

        <p aria-live="polite" className="sr-only">Imagen {safeIndex + 1} de {images.length}</p>

        {hasMultipleImages ? (
          <div aria-label="Miniaturas de la galería" className={`mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin] ${compact ? "scroll-px-1" : "scroll-px-2"}`} role="group">
            {images.map((image, index) => {
              const selected = index === safeIndex;
              return (
                <button
                  aria-label={`Mostrar imagen ${index + 1} de ${images.length}`}
                  aria-pressed={selected}
                  className={`relative shrink-0 snap-start cursor-pointer overflow-hidden rounded-md border-2 bg-[var(--color-surface-subtle)] transition-[border-color,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--booking-brand)] ${compact ? "h-16 w-20" : "h-20 w-28 sm:h-24 sm:w-32"} ${selected ? "border-[var(--booking-brand)] opacity-100" : "border-transparent opacity-65 hover:border-[var(--color-line-strong)] hover:opacity-100"}`}
                  key={image.id}
                  onClick={() => selectImage(index)}
                  ref={(element) => { thumbnailRefs.current[index] = element; }}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${image.image_url})` }}
                  />
                  <span className={`absolute inset-x-0 bottom-0 h-1 ${selected ? "bg-[var(--booking-brand)]" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
