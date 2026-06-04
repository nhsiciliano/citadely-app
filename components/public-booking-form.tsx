"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  buildBookingSlots,
  formatCurrency,
  getBookingAmountCents,
  getBookingPaymentLabel,
  type Appointment,
  type Business,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function PublicBookingForm({
  business,
  services,
  appointments,
  availabilitySlots,
}: {
  business: Business;
  services: Service[];
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
}) {
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id ?? "");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;
  const slots = useMemo(
    () => buildBookingSlots(appointments, selectedService, availabilitySlots),
    [appointments, selectedService, availabilitySlots],
  );
  const availableSlots = slots.filter((slot) => slot.available);
  const calendarDays = useMemo(() => {
    const byDay = new Map<string, typeof availableSlots>();
    for (const slot of availableSlots) {
      byDay.set(slot.dateKey, [...(byDay.get(slot.dateKey) ?? []), slot]);
    }
    return Array.from(byDay.entries()).map(([dateKey, daySlots]) => ({
      dateKey,
      dateLabel: daySlots[0]?.dateLabel ?? "",
      weekdayLabel: daySlots[0]?.weekdayLabel ?? "",
      slots: daySlots,
    }));
  }, [availableSlots]);
  const selectedDay =
    (selectedDateKey ? calendarDays.find((day) => day.dateKey === selectedDateKey) : null) ?? calendarDays[0] ?? null;
  const selectedDaySlots = selectedDay?.slots ?? [];
  const selectedSlotData = slots.find((slot) => slot.startsAt === selectedSlot) ?? null;

  async function reserveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);

    if (!selectedService || !selectedSlot) {
      setPending(false);
      setError("Elegí un servicio y un horario disponible.");
      return;
    }

    const form = new FormData(formElement);
    const startsAt = new Date(selectedSlot);
    const { data: bookingData, error: bookingError } = await insforge.database.rpc("create_public_booking", {
      p_business_id: business.id,
      p_service_id: selectedService.id,
      p_starts_at: startsAt.toISOString(),
      p_client_name: String(form.get("name") ?? ""),
      p_client_email: String(form.get("email") ?? ""),
      p_client_phone: String(form.get("phone") ?? ""),
      p_client_message: String(form.get("message") ?? ""),
    });

    if (bookingError) {
      setPending(false);
      setError(getErrorMessage(bookingError));
      return;
    }

    const booking = (Array.isArray(bookingData) ? bookingData[0] : bookingData) as
      | { amount_cents?: number | null; deposit_expires_at?: string | null; status?: string | null }
      | undefined;
    const amountCents = booking?.amount_cents ?? getBookingAmountCents(selectedService);

    setPending(false);
    setSuccess(
      amountCents > 0
        ? `Pre-reserva creada. Transferí ${formatCurrency(amountCents, business.currency)} en los próximos 30 minutos y el negocio confirmará tu turno cuando reciba la seña.${booking?.deposit_expires_at ? ` Vence ${new Date(booking.deposit_expires_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}.` : ""}`
        : "Reserva confirmada. El negocio ya puede verla en su agenda.",
    );
    formElement.reset();
    setSelectedSlot("");
  }

  if (services.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-6">
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">Reservas pausadas</h2>
        <p className="mt-3 text-[var(--ink-soft)]">
          Este negocio todavía no publicó servicios activos.
        </p>
      </div>
    );
  }

  return (
    <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]" onSubmit={reserveAppointment}>
      <div className="lg:col-span-2">
        {error ? <FormMessage type="error">{error}</FormMessage> : null}
        {success ? <FormMessage type="success">{success}</FormMessage> : null}
      </div>

      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terracotta)]">
            01 · Elegí el servicio
          </p>
          <div className="mt-5 grid gap-4">
            {services.map((service) => (
              <button
                className={`group overflow-hidden rounded-[1.5rem] border text-left shadow-sm ${
                  service.id === selectedServiceId
                    ? "border-[var(--reception)] bg-white"
                    : "border-[var(--line)] bg-white/60 hover:border-[var(--line-strong)]"
                }`}
                key={service.id}
                onClick={() => {
                  setSelectedServiceId(service.id);
                  setSelectedDateKey("");
                  setSelectedSlot("");
                }}
                type="button"
              >
                <span className="grid gap-0 sm:grid-cols-[170px_1fr]">
                  {service.image_url ? (
                    <span
                      aria-hidden="true"
                      className="block h-44 w-full bg-cover bg-center sm:h-full"
                      style={{ backgroundImage: `url(${service.image_url})` }}
                    />
                  ) : (
                    <span className="agenda-grid flex h-44 items-center justify-center bg-[var(--reception-soft)] text-5xl font-semibold text-[var(--reception)] sm:h-full">
                      {service.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="block p-5">
                    <span className="flex flex-wrap items-start justify-between gap-3">
                      <span>
                        <span className="block text-xl font-semibold tracking-[-0.04em]">{service.name}</span>
                        <span className="mt-1 block text-sm text-[var(--ink-soft)]">
                          {service.duration_minutes} min · {formatCurrency(service.price_cents, business.currency)}
                        </span>
                      </span>
                      <span className="rounded-full bg-[var(--reception-soft)] px-3 py-1 text-xs font-semibold text-[var(--reception)]">
                        {getBookingPaymentLabel(service, business.currency)}
                      </span>
                    </span>
                    {service.description ? (
                      <span className="mt-4 block text-sm leading-6 text-[var(--ink-soft)]">
                        {service.description}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {selectedService && getBookingAmountCents(selectedService) > 0 ? (
            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-sm leading-6 text-[var(--ink-soft)]">
              <p className="font-semibold text-[var(--ink)]">Datos para transferir la seña</p>
              {business.payment_alias ? <p className="mt-2">Alias: <strong>{business.payment_alias}</strong></p> : null}
              {business.payment_cbu ? <p>CBU/CVU: <strong>{business.payment_cbu}</strong></p> : null}
              {business.payment_instructions ? <p className="mt-2">{business.payment_instructions}</p> : null}
              {!business.payment_alias && !business.payment_cbu ? (
                <p className="mt-2">El negocio todavía no cargó alias o CBU/CVU. Reservá y coordiná el pago directamente con el negocio.</p>
              ) : null}
              <p className="mt-2">La pre-reserva se mantiene por 30 minutos hasta que el negocio confirme la seña.</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--reception)]">
            02 · Calendario
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {calendarDays.length === 0 ? (
              <p className="col-span-full rounded-2xl border border-dashed border-[var(--line-strong)] bg-white/50 p-4 text-sm text-[var(--ink-soft)]">
                No hay horarios disponibles para este servicio en los próximos días.
              </p>
            ) : null}
            {calendarDays.map((day) => (
              <button
                className={`rounded-2xl border px-3 py-4 text-center ${
                  day.dateKey === selectedDay?.dateKey
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] bg-white/70 text-[var(--ink)] hover:border-[var(--line-strong)]"
                }`}
                key={day.dateKey}
                onClick={() => {
                  setSelectedDateKey(day.dateKey);
                  setSelectedSlot("");
                }}
                type="button"
              >
                <span className="block text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{day.weekdayLabel}</span>
                <span className="mt-1 block text-lg font-semibold tracking-[-0.03em]">{day.dateLabel}</span>
                <span className="mt-2 block text-xs font-semibold opacity-70">{day.slots.length} turnos</span>
              </button>
            ))}
          </div>

          {selectedDay ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-[var(--ink-soft)]">
                Horarios para {selectedDay.weekdayLabel} {selectedDay.dateLabel}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selectedDaySlots.map((slot) => (
                  <button
                    className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${
                      slot.startsAt === selectedSlot
                        ? "border-[var(--reception)] bg-[var(--reception)] text-white"
                        : "border-[var(--line)] bg-white/70 text-[var(--ink)] hover:border-[var(--line-strong)]"
                    }`}
                    key={slot.startsAt}
                    onClick={() => setSelectedSlot(slot.startsAt)}
                    type="button"
                  >
                    {slot.timeLabel}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="h-fit rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6 lg:sticky lg:top-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--clinical)]">
          03 · Confirmá
        </p>
        <div className="mt-5 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4">
          <p className="text-sm font-semibold text-[var(--ink-soft)]">Tu turno</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.04em]">
            {selectedService?.name ?? "Seleccioná un servicio"}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {selectedSlotData ? `${selectedSlotData.label} · ${selectedService?.duration_minutes ?? 0} min` : "Elegí día y horario en el calendario"}
          </p>
        </div>
        <div className="mt-5 grid gap-4">
          <Field label="Nombre y apellido" name="name" placeholder="Tu nombre y apellido" />
          <Field label="Email" name="email" placeholder="tu@email.com" type="email" />
          <Field label="Teléfono" name="phone" placeholder="Tu teléfono" />
          <Field label="Nota para el negocio" name="message" placeholder="Opcional" required={false} />
        </div>
        <div className="mt-6">
          <SubmitButton pending={pending}>Confirmar reserva</SubmitButton>
        </div>
      </section>
    </form>
  );
}
