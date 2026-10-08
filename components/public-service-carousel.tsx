"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { formatCurrency, getBookingPaymentLabel, type Service } from "@/lib/citadely-db";

export function PublicServiceCarousel({ services, currency, brandColor, selectedServiceId, onSelect, compact = false }: {
  services: Service[];
  currency: string;
  brandColor: string;
  selectedServiceId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const [exploredService, setExploredService] = useState<Service | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const trackRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmedRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    if (exploredService) dialogRef.current?.showModal();
  }, [exploredService]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () => setEdges({ start: track.scrollLeft < 2, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    track.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); track.removeEventListener("scroll", update); };
  }, [services.length]);

  function move(direction: number) {
    const track = trackRef.current;
    const card = track?.firstElementChild as HTMLElement | null;
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
    track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return (
    <div className={`public-service-catalog ${compact ? "public-service-catalog-compact" : ""}`} style={{ "--booking-brand": brandColor } as CSSProperties}>
      {services.length > 1 ? (
        <div aria-label="Navegación de servicios" className="mb-3 flex justify-end gap-2">
          <button aria-label="Ver servicio anterior" className="public-carousel-control" disabled={edges.start} onClick={() => move(-1)} type="button"><ChevronLeft aria-hidden="true" size={20} /></button>
          <button aria-label="Ver servicio siguiente" className="public-carousel-control" disabled={edges.end} onClick={() => move(1)} type="button"><ChevronRight aria-hidden="true" size={20} /></button>
        </div>
      ) : null}
      <div aria-label="Servicios disponibles" aria-roledescription="carrusel" className="public-service-track focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--booking-brand)]" ref={trackRef} role="region" tabIndex={0} onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}>
        {services.map((service) => {
          const selected = service.id === selectedServiceId;
          return (
            <button aria-haspopup="dialog" aria-label={`Ver detalle de ${service.name}${selected ? ", seleccionado" : ""}`} aria-pressed={selected} className={`public-service-card ${selected ? "public-service-card-selected" : ""}`} key={service.id} onClick={(event) => {
              triggerRef.current = event.currentTarget;
              confirmedRef.current = false;
              setExploredService(service);
            }} type="button">
              <span className="public-service-image">
                {service.image_url ? <span aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${service.image_url})` }} /> : <span aria-hidden="true" className="font-display text-5xl font-semibold text-[var(--color-ink-soft)]">{service.name.slice(0, 1).toUpperCase()}</span>}
              </span>
              <span className="public-service-content">
                {selected ? <span className="public-service-selected"><Check aria-hidden="true" size={14} strokeWidth={3} />Seleccionado</span> : null}
                <span className="public-service-title">{service.name}</span>
                <span className="public-service-meta">
                  <span className="font-mono text-base font-semibold tabular-nums">{formatCurrency(service.price_cents, currency)}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]"><Clock aria-hidden="true" size={16} />{service.duration_minutes} min</span>
                </span>
                <span className="public-service-detail">Ver detalle</span>
              </span>
            </button>
          );
        })}
      </div>
      <dialog aria-labelledby={titleId} className="public-service-dialog" ref={dialogRef} onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']");
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} onClose={() => {
        setExploredService(null);
        if (!confirmedRef.current) triggerRef.current?.focus({ preventScroll: true });
      }} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
      }}>
        {exploredService ? (
          <>
            <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4 sm:px-7">
              <h2 className="min-w-0 break-words font-display text-2xl font-semibold tracking-[-0.025em]" id={titleId}>{exploredService.name}</h2>
              <button aria-label="Cerrar detalle del servicio" autoFocus className="public-carousel-control shrink-0" onClick={() => dialogRef.current?.close()} type="button"><X aria-hidden="true" size={22} /></button>
            </header>
            <div aria-label="Información del servicio" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7" tabIndex={0}>
              {exploredService.image_url ? <div aria-label={`Imagen de ${exploredService.name}`} className="mb-6 aspect-[4/3] bg-[var(--color-surface-subtle)] bg-contain bg-center bg-no-repeat" role="img" style={{ backgroundImage: `url(${exploredService.image_url})` }} /> : null}
              {exploredService.description ? <p className="mb-6 whitespace-pre-line break-words text-base leading-7 text-[var(--color-ink-soft)]">{exploredService.description}</p> : null}
              <dl className="grid grid-cols-2 gap-5 border-y border-[var(--color-line)] py-5">
                <div><dt className="text-sm text-[var(--color-ink-soft)]">Precio</dt><dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatCurrency(exploredService.price_cents, currency)}</dd></div>
                <div><dt className="text-sm text-[var(--color-ink-soft)]">Duración</dt><dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{exploredService.duration_minutes} min</dd></div>
              </dl>
              <p className="mt-5 text-sm font-semibold text-[var(--color-ink)]">{getBookingPaymentLabel(exploredService, currency)}</p>
            </div>
            <footer className="border-t border-[var(--color-line)] bg-white px-5 py-4 sm:px-7">
              <button className="public-service-confirm w-full cursor-pointer rounded-md px-5 text-sm font-bold transition-[filter] hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--booking-brand)]" onClick={() => {
                confirmedRef.current = true;
                dialogRef.current?.close();
                onSelect(exploredService.id);
              }} style={{ backgroundColor: brandColor, color: "var(--booking-brand-foreground, white)" }} type="button">Elegir este servicio</button>
            </footer>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
