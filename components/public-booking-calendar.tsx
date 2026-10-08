"use client";

import { useId, useState, type Ref } from "react";
import { ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import { formatPublicBookingDateKey, type PublicBookingSlot } from "@/lib/citadely-db";

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function dayLabel(dateKey: string) {
  const label = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${dateKey}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function PublicBookingCalendar({
  slots,
  serviceSelected,
  selectedDateKey,
  selectedSlot,
  onDateChange,
  onSlotChange,
  headingRef,
  compact = false,
}: {
  slots: PublicBookingSlot[];
  serviceSelected: boolean;
  selectedDateKey: string;
  selectedSlot: string;
  onDateChange: (dateKey: string) => void;
  onSlotChange: (startsAt: string) => void;
  headingRef?: Ref<HTMLHeadingElement>;
  compact?: boolean;
}) {
  const [monthCursor, setMonthCursor] = useState<string | null>(null);
  const headingId = useId();
  const Heading = compact ? "h3" : "h2";
  const Subheading = compact ? "h4" : "h3";
  const availableSlots = slots.filter((slot) => slot.available);
  const monthKeys = Array.from(new Set(slots.map((slot) => slot.dateKey.slice(0, 7))));
  const firstAvailableDate = availableSlots[0]?.dateKey ?? slots[0]?.dateKey ?? "";
  const activeDateKey = selectedDateKey && slots.some((slot) => slot.dateKey === selectedDateKey)
    ? selectedDateKey
    : firstAvailableDate;
  const fallbackMonth = slots[0]?.dateKey.slice(0, 7) ?? formatPublicBookingDateKey(new Date()).slice(0, 7);
  const currentMonth = monthCursor && monthKeys.includes(monthCursor)
    ? monthCursor
    : activeDateKey.slice(0, 7) || fallbackMonth;
  const currentMonthIndex = monthKeys.indexOf(currentMonth);
  const [year, month] = currentMonth.split("-").map(Number);
  const leadingDays = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const availableByDate = new Map<string, number>();
  const publishedByDate = new Map<string, number>();
  for (const slot of slots) publishedByDate.set(slot.dateKey, (publishedByDate.get(slot.dateKey) ?? 0) + 1);
  for (const slot of availableSlots) availableByDate.set(slot.dateKey, (availableByDate.get(slot.dateKey) ?? 0) + 1);
  const selectedDaySlots = slots.filter((slot) => slot.dateKey === activeDateKey);

  function moveMonth(direction: -1 | 1) {
    const nextMonth = monthKeys[currentMonthIndex + direction];
    if (!nextMonth) return;
    setMonthCursor(nextMonth);
    onDateChange((availableSlots.find((slot) => slot.dateKey.startsWith(nextMonth)) ?? slots.find((slot) => slot.dateKey.startsWith(nextMonth)))?.dateKey ?? "");
    onSlotChange("");
  }

  return (
    <section aria-labelledby={headingId} className={`public-booking-calendar public-theme-card ${compact ? "public-booking-calendar-compact" : ""}`}>
      <div className="public-booking-calendar-heading">
        <span aria-hidden="true" className="public-booking-step">02</span>
        <Heading className="font-display text-2xl font-semibold tracking-[-0.03em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--booking-brand)]" id={headingId} ref={headingRef} tabIndex={-1}>Elegí día y horario</Heading>
      </div>
      {!serviceSelected ? (
        <p className="mt-6 border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] p-5 text-sm leading-6 text-[var(--color-ink-soft)]">Elegí un servicio para ver días y horarios disponibles.</p>
      ) : slots.length === 0 ? (
        <p className="mt-6 border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] p-5 text-sm leading-6 text-[var(--color-ink-soft)]">Este servicio no tiene horarios disponibles ahora. Probá otro servicio o volvé cuando el negocio publique nueva agenda.</p>
      ) : (
        <div className="public-booking-calendar-layout">
          <div className="public-booking-month">
            <div className="public-booking-month-heading">
              <Subheading className="font-display text-lg font-semibold tracking-[-0.02em]">{monthLabel(currentMonth)}</Subheading>
              <div className="flex gap-2">
                <button aria-label="Mes anterior con turnos" className="public-carousel-control" disabled={currentMonthIndex <= 0} onClick={() => moveMonth(-1)} type="button"><ChevronLeft aria-hidden="true" size={19} /></button>
                <button aria-label="Mes siguiente con turnos" className="public-carousel-control" disabled={currentMonthIndex < 0 || currentMonthIndex >= monthKeys.length - 1} onClick={() => moveMonth(1)} type="button"><ChevronRight aria-hidden="true" size={19} /></button>
              </div>
            </div>
            <div aria-label={`Fechas de ${monthLabel(currentMonth)}`} className="public-booking-month-grid" role="group">
              {weekdays.map((weekday) => <span aria-hidden="true" className="public-booking-weekday" key={weekday}>{weekday}</span>)}
              {Array.from({ length: leadingDays }, (_, index) => <span aria-hidden="true" key={`empty-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const dateKey = `${currentMonth}-${String(day).padStart(2, "0")}`;
                const count = availableByDate.get(dateKey) ?? 0;
                const publishedCount = publishedByDate.get(dateKey) ?? 0;
                const selected = dateKey === activeDateKey;
                const dateLabel = dayLabel(dateKey);
                return (
                  <button
                    aria-label={`${dateLabel}, ${count ? `${count} ${count === 1 ? "horario disponible" : "horarios disponibles"}` : publishedCount ? "horarios completos" : "sin horarios disponibles"}`}
                    aria-pressed={selected}
                    className="public-booking-day"
                    data-full={publishedCount > 0 && count === 0}
                    disabled={!publishedCount}
                    key={dateKey}
                    onClick={() => { onDateChange(dateKey); onSlotChange(""); }}
                    type="button"
                  >
                    <span>{day}</span>
                    {publishedCount ? <span aria-hidden="true" className="public-booking-day-dot" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="public-booking-times">
            <Subheading className="font-display text-lg font-semibold tracking-[-0.02em]">Horarios disponibles</Subheading>
            <p aria-live="polite" className="mt-1 text-sm text-[var(--color-ink-soft)]">{activeDateKey ? dayLabel(activeDateKey) : "Elegí un día"}</p>
            <div className="public-booking-time-grid">
              {selectedDaySlots.map((slot) => {
                const selected = slot.startsAt === selectedSlot;
                const capacityLabel = slot.capacity > 1 ? `${slot.remaining} de ${slot.capacity} cupos disponibles` : "disponible";
                return (
                  <button
                    aria-label={`${slot.timeLabel}, ${slot.blockedByOtherService ? "no disponible" : !slot.remaining ? "completo" : capacityLabel}`}
                    aria-pressed={selected}
                    className="public-booking-time"
                    disabled={!slot.available}
                    key={slot.startsAt}
                    onClick={() => onSlotChange(slot.startsAt)}
                    type="button"
                  >
                    <span className="font-mono text-sm font-semibold tabular-nums">{slot.timeLabel}</span>
                    {slot.available && slot.capacity > 1 ? <span className="public-booking-cups"><UsersRound aria-hidden="true" size={14} />Cupos</span> : null}
                    {!slot.available ? <span className="text-xs">{slot.blockedByOtherService ? "No disponible" : "Completo"}</span> : null}
                    {slot.available && slot.capacity > 1 ? <span aria-hidden="true" className="public-slot-tooltip">{slot.remaining} de {slot.capacity} cupos disponibles</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
