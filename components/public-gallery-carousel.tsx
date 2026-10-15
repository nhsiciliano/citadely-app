"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { BusinessGalleryImage } from "@/lib/citadely-db";

type PublicGalleryCarouselProps = {
  businessName: string;
  compact?: boolean;
  images: BusinessGalleryImage[];
  themeStyle?: CSSProperties;
};

type GalleryFrame = {
  current: BusinessGalleryImage | undefined;
  previous: BusinessGalleryImage | undefined;
};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PublicGalleryCarousel({ businessName, compact = false, images, themeStyle }: PublicGalleryCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [frame, setFrame] = useState<GalleryFrame>({ current: images[0], previous: undefined });
  const [loadError, setLoadError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const ignoreClickUntil = useRef(0);
  const titleId = useId();
  const dialogTitleId = useId();
  const Heading = compact ? "h3" : "h2";
  const safeIndex = Math.min(activeIndex, Math.max(images.length - 1, 0));
  const activeImage = images[safeIndex];
  const displayedIndex = Math.max(0, images.findIndex((image) => image.id === frame.current?.id));
  const hasMultipleImages = images.length > 1;
  const previousIndex = (displayedIndex - 1 + images.length) % images.length;
  const nextIndex = (displayedIndex + 1) % images.length;

  useEffect(() => {
    if (!activeImage) return;
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      setLoadError("");
      setFrame((current) => current.current?.image_url === activeImage.image_url
        ? current
        : { current: activeImage, previous: reducedMotion() ? undefined : current.current });
    };
    image.onerror = () => {
      if (!cancelled) setLoadError("No se pudo cargar la imagen. Probá con otra.");
    };
    image.src = activeImage.image_url;
    return () => { cancelled = true; };
  }, [activeImage]);

  function selectImage(index: number) {
    setActiveIndex(index);
    window.requestAnimationFrame(() => {
      const strip = dotsRef.current;
      const dot = dotRefs.current[index];
      if (!strip || !dot) return;
      const left = strip.scrollLeft + dot.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - dot.clientWidth) / 2;
      strip.scrollTo({ left, behavior: reducedMotion() ? "auto" : "smooth" });
    });
  }

  function selectFromClick(index: number) {
    if (Date.now() >= ignoreClickUntil.current) selectImage(index);
  }

  function move(direction: -1 | 1) {
    const fromIndex = loadError ? displayedIndex : safeIndex;
    selectImage((fromIndex + direction + images.length) % images.length);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!hasMultipleImages) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    if (!hasMultipleImages || touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const distance = endX - touchStartX.current;
    const verticalDistance = (event.changedTouches[0]?.clientY ?? 0) - (touchStartY.current ?? 0);
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(distance) < 48 || Math.abs(distance) <= Math.abs(verticalDistance)) return;
    ignoreClickUntil.current = Date.now() + 400;
    move(distance > 0 ? -1 : 1);
  }

  function finishTransition() {
    setFrame((current) => current.current?.id === frame.current?.id ? { ...current, previous: undefined } : current);
  }

  if (!activeImage) return null;

  return (
    <section aria-labelledby={titleId} className={`public-gallery-section border-b border-line bg-white ${compact ? "public-gallery-compact px-6 py-8 sm:px-9" : "py-10 sm:py-14"} ${themeStyle ? "public-theme-active public-theme-gallery" : ""}`} style={themeStyle}>
      <div className={compact ? "" : "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"}>
        <Heading className={`font-display font-semibold tracking-[-0.035em] ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`} id={titleId}>Galería</Heading>
        {!compact ? <p className="mt-2 text-sm text-ink-soft">Conocé nuestro espacio y trabajo.</p> : null}

        <div
          aria-label={`Galería de ${businessName}`}
          aria-roledescription="carrusel"
          className="public-gallery-carousel mt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--booking-brand)]"
          onKeyDown={handleKeyDown}
          onTouchEnd={handleTouchEnd}
          onTouchStart={handleTouchStart}
          role="region"
          tabIndex={0}
        >
          <div className="public-gallery-composition">
            {images.length > 2 ? (
              <button aria-label={`Mostrar imagen ${previousIndex + 1} de ${images.length}`} className="public-gallery-side public-gallery-side-left" onClick={() => selectFromClick(previousIndex)} type="button">
                <span aria-hidden="true" style={{ backgroundImage: `url(${images[previousIndex].image_url})` }} />
              </button>
            ) : null}
            {hasMultipleImages ? (
              <button aria-label={`Mostrar imagen ${nextIndex + 1} de ${images.length}`} className="public-gallery-side public-gallery-side-right" onClick={() => selectFromClick(nextIndex)} type="button">
                <span aria-hidden="true" style={{ backgroundImage: `url(${images[nextIndex].image_url})` }} />
              </button>
            ) : null}
            <button
              aria-haspopup="dialog"
              aria-label={`Ampliar imagen ${displayedIndex + 1} de ${images.length} de ${businessName}`}
              className="public-gallery-main"
              onClick={() => { if (Date.now() >= ignoreClickUntil.current) dialogRef.current?.showModal(); }}
              ref={triggerRef}
              type="button"
            >
              {frame.previous ? <span aria-hidden="true" className="public-gallery-previous public-gallery-photo" key={`previous-${frame.previous.id}`} style={{ backgroundImage: `url(${frame.previous.image_url})` }} /> : null}
              <span aria-hidden="true" className={`public-gallery-photo ${frame.previous ? "public-gallery-current" : ""}`} key={frame.current?.id} onAnimationEnd={finishTransition} style={{ backgroundImage: `url(${frame.current?.image_url ?? activeImage.image_url})` }} />
              <span className="public-gallery-expand">Ver imagen completa</span>
            </button>
          </div>

          {hasMultipleImages ? (
            <div className="public-gallery-controls">
              <button aria-label="Ver imagen anterior" className="public-gallery-arrow" onClick={() => { if (Date.now() >= ignoreClickUntil.current) move(-1); }} type="button"><ChevronLeft aria-hidden="true" size={20} /></button>
              <div aria-label="Imágenes de la galería" className="public-gallery-dots" ref={dotsRef} role="group">
                {images.map((image, index) => (
                  <button
                    aria-current={index === displayedIndex ? "true" : undefined}
                    aria-label={`Mostrar imagen ${index + 1} de ${images.length}`}
                    className="public-gallery-dot-button"
                    key={image.id}
                    onClick={() => selectFromClick(index)}
                    ref={(element) => { dotRefs.current[index] = element; }}
                    type="button"
                  ><span aria-hidden="true" /></button>
                ))}
              </div>
              <button aria-label="Ver imagen siguiente" className="public-gallery-arrow" onClick={() => { if (Date.now() >= ignoreClickUntil.current) move(1); }} type="button"><ChevronRight aria-hidden="true" size={20} /></button>
              <span className="public-gallery-count" aria-hidden="true">{displayedIndex + 1} / {images.length}</span>
            </div>
          ) : null}
        </div>

        <p aria-live="polite" className={loadError ? "mt-3 text-sm text-danger" : "sr-only"}>{loadError || `Imagen ${displayedIndex + 1} de ${images.length}`}</p>

        <dialog
          aria-labelledby={dialogTitleId}
          className="public-gallery-dialog"
          onClick={(event: MouseEvent<HTMLDialogElement>) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
          onClose={() => triggerRef.current?.focus({ preventScroll: true })}
          onKeyDown={handleKeyDown}
          onTouchEnd={(event) => { event.stopPropagation(); handleTouchEnd(event); }}
          onTouchStart={(event) => { event.stopPropagation(); handleTouchStart(event); }}
          ref={dialogRef}
        >
          <div className="public-gallery-dialog-content">
            <div className="public-gallery-dialog-header">
              <h2 className="font-display text-base font-semibold text-white" id={dialogTitleId}>Galería de {businessName}</h2>
              <button aria-label="Cerrar imagen completa" autoFocus className="public-gallery-dialog-button" onClick={() => dialogRef.current?.close()} type="button"><X aria-hidden="true" size={23} /></button>
            </div>
            <div className="public-gallery-dialog-stage">
              {frame.previous ? <span aria-hidden="true" className="public-gallery-previous public-gallery-photo" style={{ backgroundImage: `url(${frame.previous.image_url})` }} /> : null}
              <span aria-label={`${businessName}, imagen ${displayedIndex + 1} de ${images.length}`} className={`public-gallery-photo ${frame.previous ? "public-gallery-current" : ""}`} role="img" style={{ backgroundImage: `url(${frame.current?.image_url ?? activeImage.image_url})` }} />
              {hasMultipleImages ? (
                <>
                  <button aria-label="Imagen anterior en pantalla completa" className="public-gallery-dialog-button public-gallery-dialog-prev" onClick={() => { if (Date.now() >= ignoreClickUntil.current) move(-1); }} type="button"><ChevronLeft aria-hidden="true" size={24} /></button>
                  <button aria-label="Imagen siguiente en pantalla completa" className="public-gallery-dialog-button public-gallery-dialog-next" onClick={() => { if (Date.now() >= ignoreClickUntil.current) move(1); }} type="button"><ChevronRight aria-hidden="true" size={24} /></button>
                </>
              ) : null}
            </div>
            <p aria-live="polite" className="public-gallery-dialog-count">{displayedIndex + 1} / {images.length}</p>
          </div>
        </dialog>
      </div>
    </section>
  );
}
