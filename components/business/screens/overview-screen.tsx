"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarPlus, CircleDollarSign, Copy, ExternalLink, Plus, Sparkles, UserPlus } from "lucide-react";
import { calculateStats, formatCurrency } from "@/lib/citadely-db";
import { READ_ONLY_HINT } from "@/lib/business-access";
import { formatInTimeZone, isSameDayInTimeZone, toTimeKey } from "@/lib/time";
import { AppointmentDetailDrawer, NewAppointmentDrawer } from "../appointment-actions";
import { useWorkspace } from "../workspace-context";
import { EmptyState, PageHeader, StatusBadge } from "../workspace-ui";

const DATE_OPTIONS = { weekday: "long", day: "numeric", month: "long" } as const;

export function OverviewScreen() {
  const { access, appointments, availabilitySlots, business, publicUrl, services } = useWorkspace();
  const readOnly = !access.hasDashboardAccess;
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const now = new Date();
  const timeZone = business.timezone;
  const stats = calculateStats(appointments, services, timeZone, now, availabilitySlots);
  const formatDate = (value: Date | string) => formatInTimeZone(value, timeZone, DATE_OPTIONS);
  const formatTime = (value: string) => toTimeKey(value, timeZone);
  const isDemoWorkspace = business.slug === "citadely-demo-ux";

  const activeAppointments = useMemo(() => appointments.filter((appointment) => appointment.status !== "cancelled"), [appointments]);
  const todayAppointments = activeAppointments.filter((appointment) => isSameDayInTimeZone(appointment.starts_at, now, timeZone));
  const upcoming = activeAppointments.filter((appointment) => new Date(appointment.starts_at) >= now);
  const nextAppointment = upcoming[0] ?? null;
  const pendingDeposits = appointments.filter((appointment) => appointment.status === "pending_payment");
  const selected = appointments.find((appointment) => appointment.id === selectedId) ?? null;

  async function copyPublicUrl() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <PageHeader
        actions={<button className="button-primary" disabled={readOnly} onClick={() => setCreateOpen(true)} title={readOnly ? READ_ONLY_HINT : undefined} type="button"><Plus aria-hidden="true" size={18} />Nuevo turno</button>}
        description={`Jornada actual · próximos turnos y señas pendientes.${isDemoWorkspace ? " Cuenta demo con datos ficticios." : ""}`}
        title={`Hoy, ${formatDate(now)}`}
      />

      <div className="grid gap-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-6">
        <section className="grid overflow-hidden border border-line bg-white shadow-surface xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
          <div className="relative min-h-[168px] px-6 py-5 sm:pl-20 sm:pr-8">
            <span aria-hidden="true" className="absolute bottom-0 left-7 top-0 hidden w-px bg-primary sm:block" />
            <span aria-hidden="true" className="absolute left-[22px] top-8 hidden h-3 w-3 rounded-full border-[3px] border-white bg-primary ring-2 ring-primary sm:block" />
            <p className="text-sm font-semibold text-ink-soft">Próximo turno</p>
            {nextAppointment ? (
              <button className="mt-4 grid w-full gap-4 text-left sm:grid-cols-[130px_minmax(0,1fr)_auto] sm:items-center" onClick={() => setSelectedId(nextAppointment.id)} type="button">
                <div>
                  <p className="font-mono text-4xl font-semibold tracking-[-0.04em] text-primary">{formatTime(nextAppointment.starts_at)}</p>
                  <p className="mt-2 text-xs font-semibold text-primary">{isSameDayInTimeZone(nextAppointment.starts_at, now, timeZone) ? "Hoy" : formatDate(nextAppointment.starts_at)}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold">{nextAppointment.services?.name ?? "Servicio"}</p>
                  <p className="mt-1 text-sm text-ink-soft">{nextAppointment.clients?.name ?? "Cliente"}</p>
                  <div className="mt-3"><StatusBadge status={nextAppointment.status} /></div>
                </div>
                <span className="button-secondary">Ver turno<ArrowRight aria-hidden="true" size={16} /></span>
              </button>
            ) : (
              <EmptyState title="La agenda inmediata está libre" text="Creá un turno o compartí tu página pública para recibir nuevas reservas." />
            )}
          </div>
          <div className="border-t border-line bg-surface-subtle p-6 xl:border-l xl:border-t-0">
            <p className="text-sm font-semibold">Página de reservas</p>
            <p className="mt-2 break-all text-sm leading-6 text-ink-soft">{publicUrl}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="button-secondary" onClick={copyPublicUrl} type="button"><Copy aria-hidden="true" size={16} />{copied ? "Copiado" : "Copiar enlace"}</button>
              <Link className="button-secondary" href={publicUrl} target="_blank"><ExternalLink aria-hidden="true" size={16} />Abrir</Link>
            </div>
          </div>
        </section>

        <section aria-label="Resumen de la jornada" className="metrics-strip">
          <div><p>Ocupación hoy</p><strong>{stats.occupancy}%</strong><span>{stats.publishedMinutes > 0 ? `sobre ${Math.round((stats.publishedMinutes / 60) * 10) / 10} h publicadas` : "Sin horarios publicados hoy"}</span></div>
          <div><p>Turnos hoy</p><strong>{stats.todayAppointments}</strong><span>{upcoming.length} próximos</span></div>
          <div><p>Ingresos del mes</p><strong>{formatCurrency(stats.monthlyRevenueCents, business.currency)}</strong><span>servicios agendados</span></div>
          <div><p>Servicios activos</p><strong>{services.filter((service) => service.is_active).length}</strong><span>de {services.length}</span></div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
          <section className="surface-section">
            <div className="section-heading-row">
              <div><h2>Señas pendientes</h2><p>Reservas que todavía necesitan confirmación.</p></div>
              <span className="count-badge">{pendingDeposits.length}</span>
            </div>
            {pendingDeposits.length === 0 ? <EmptyState title="No hay señas pendientes" text="Las reservas que requieran pago aparecerán acá." /> : (
              <div className="divide-y divide-line">
                {pendingDeposits.slice(0, 5).map((appointment) => (
                  <button className="data-row" key={appointment.id} onClick={() => setSelectedId(appointment.id)} type="button">
                    <CircleDollarSign aria-hidden="true" className="text-warning" size={19} />
                    <span className="min-w-0"><strong>{appointment.clients?.name ?? "Cliente"}</strong><small>{appointment.services?.name ?? "Servicio"} · {formatTime(appointment.starts_at)}</small></span>
                    <span className="font-mono text-sm font-semibold">{formatCurrency(appointment.deposit_amount_cents, business.currency)}</span>
                    <ArrowRight aria-hidden="true" className="text-ink-muted" size={16} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="surface-section">
            <div className="section-heading-row"><div><h2>Acciones frecuentes</h2><p>Atajos a las tareas de todos los días.</p></div></div>
            <div className="grid divide-y divide-line">
              <button className="quick-action" onClick={() => setCreateOpen(true)} type="button"><CalendarPlus aria-hidden="true" size={19} /><span><strong>Crear turno</strong><small>Agendá una cita manual</small></span><ArrowRight aria-hidden="true" size={16} /></button>
              <Link className="quick-action" href="/negocio/clientes?nuevo=1"><UserPlus aria-hidden="true" size={19} /><span><strong>Agregar cliente</strong><small>Creá una ficha nueva</small></span><ArrowRight aria-hidden="true" size={16} /></Link>
              <Link className="quick-action" href="/negocio/servicios?nuevo=1"><Sparkles aria-hidden="true" size={19} /><span><strong>Crear servicio</strong><small>Definí precio y horarios</small></span><ArrowRight aria-hidden="true" size={16} /></Link>
            </div>
          </section>
        </div>

        <section className="surface-section">
          <div className="section-heading-row">
            <div><h2>Agenda de hoy</h2><p>{todayAppointments.length ? "Tus turnos ordenados cronológicamente." : "No hay turnos para hoy."}</p></div>
            <Link className="text-link" href="/negocio/agenda">Ver agenda completa<ArrowRight aria-hidden="true" size={16} /></Link>
          </div>
          {todayAppointments.length === 0 ? <EmptyState title="Jornada sin turnos" text="Podés crear un turno manual o compartir tu página pública." /> : (
            <div className="divide-y divide-line">
              {todayAppointments.map((appointment) => (
                <button className="schedule-row" key={appointment.id} onClick={() => setSelectedId(appointment.id)} type="button">
                  <span className="font-mono font-semibold text-primary">{formatTime(appointment.starts_at)}</span>
                  <span><strong>{appointment.services?.name ?? "Servicio"}</strong><small>{appointment.clients?.name ?? "Cliente"}</small></span>
                  <StatusBadge status={appointment.status} />
                  <ArrowRight aria-hidden="true" size={16} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <NewAppointmentDrawer onClose={() => setCreateOpen(false)} open={createOpen} />
      <AppointmentDetailDrawer appointment={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}
