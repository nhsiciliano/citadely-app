"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarClock, Mail, Phone, Plus, Search, UserRound } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { formatAppointmentTime, type Appointment, type Client } from "@/lib/citadely-db";
import { getClientSaveErrorMessage } from "@/lib/client-errors";
import { insforge } from "@/lib/insforge";
import { useWorkspace } from "../workspace-context";
import { Drawer, EmptyState, PageHeader, StatusBadge } from "../workspace-ui";

const HISTORY_LIMIT = 10;

export function ClientsScreen() {
  const { appointments, business, clients, refresh } = useWorkspace();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Referencia para separar turnos próximos y pasados; se fija al montar la pantalla.
  const [referenceTime] = useState(() => Date.now());

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (new URLSearchParams(window.location.search).get("nuevo") === "1") setCreateOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return clients;
    return clients.filter((client) => [client.name, client.email, client.phone].some((value) => value?.toLocaleLowerCase("es").includes(normalized)));
  }, [clients, query]);

  // Historial calculado con los turnos ya cargados en el workspace: próximo turno y últimos turnos pasados.
  const clientHistory = useMemo(() => {
    if (!selected) return { upcoming: null, past: [] as Appointment[] };
    const now = referenceTime;
    const own = appointments
      .filter((appointment) => appointment.client_id === selected.id)
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    const upcoming = own
      .filter((appointment) => new Date(appointment.starts_at).getTime() >= now && appointment.status !== "cancelled")
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null;
    const past = own.filter((appointment) => new Date(appointment.starts_at).getTime() < now).slice(0, HISTORY_LIMIT);
    return { upcoming, past };
  }, [appointments, referenceTime, selected]);

  async function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setMessage(null);
    const { error } = await insforge.database.from("clients").insert([{
      business_id: business.id,
      name: String(form.get("client_name") ?? ""),
      email: String(form.get("client_email") ?? ""),
      phone: String(form.get("client_phone") ?? ""),
    }]);
    setPending(false);
    if (error) {
      setMessage(getClientSaveErrorMessage(error));
      return;
    }
    formElement.reset();
    await refresh();
    setCreateOpen(false);
  }

  return (
    <>
      <PageHeader actions={<button className="button-primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={18} />Nuevo cliente</button>} description="Encontrá una ficha por nombre, email o teléfono y consultá sus datos de contacto." title="Clientes" />
      <div className="grid gap-5 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <label className="flex min-h-12 max-w-xl items-center gap-3 rounded-md border border-[var(--color-line)] bg-white px-4 transition-[border-color,box-shadow] hover:border-[var(--color-line-strong)] focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_rgba(9,87,217,0.1)]">
          <span className="sr-only">Buscar clientes</span>
          <Search aria-hidden="true" className="shrink-0 text-[var(--color-ink-muted)]" size={18} />
          <input className="min-w-0 flex-1 bg-transparent font-medium text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, email o teléfono" type="search" value={query} />
        </label>

        <section className="overflow-hidden border border-[var(--color-line)] bg-white shadow-[var(--shadow-surface)]">
          {filteredClients.length === 0 ? <div className="p-6"><EmptyState action={!query ? <button className="button-primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={17} />Agregar cliente</button> : undefined} text={query ? "Probá con otro nombre, email o teléfono." : "Las reservas públicas también crean fichas automáticamente."} title={query ? "No encontramos coincidencias" : "Todavía no hay clientes"} /></div> : (
            <div className="divide-y divide-[var(--color-line)]">
              {filteredClients.map((client) => (
                <button className="client-row" key={client.id} onClick={() => setSelected(client)} type="button">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]">{client.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0"><strong>{client.name}</strong><small>{client.email || "Sin email"}</small></span>
                  <span className="hidden text-sm text-[var(--color-ink-soft)] sm:block">{client.phone || "Sin teléfono"}</span>
                  <span className="text-sm font-semibold text-[var(--color-primary)]">Ver ficha</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <Drawer description="Datos de contacto e historial de turnos del cliente." onClose={() => setSelected(null)} open={Boolean(selected)} title="Ficha del cliente" width="medium">
        {selected ? <div className="grid gap-6">
          <div className="grid h-16 w-16 place-items-center rounded-md bg-[var(--color-primary)] text-2xl font-semibold text-white">{selected.name.slice(0, 1).toUpperCase()}</div>
          <div><p className="text-xl font-semibold">{selected.name}</p><p className="mt-1 font-mono text-xs text-[var(--color-ink-muted)]">#{selected.id.slice(0, 8).toUpperCase()}</p></div>
          <dl className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            <div className="grid grid-cols-[24px_1fr] gap-3 py-4"><Mail aria-hidden="true" className="text-[var(--color-primary)]" size={18} /><div><dt className="text-xs text-[var(--color-ink-muted)]">Email</dt><dd className="mt-1 text-sm font-semibold">{selected.email || "Sin email"}</dd></div></div>
            <div className="grid grid-cols-[24px_1fr] gap-3 py-4"><Phone aria-hidden="true" className="text-[var(--color-primary)]" size={18} /><div><dt className="text-xs text-[var(--color-ink-muted)]">Teléfono</dt><dd className="mt-1 text-sm font-semibold">{selected.phone || "Sin teléfono"}</dd></div></div>
          </dl>

          <section aria-labelledby="proximo-turno-cliente" className="grid gap-3">
            <h3 className="text-sm font-semibold" id="proximo-turno-cliente">Próximo turno</h3>
            {clientHistory.upcoming ? (
              <div className="flex items-center justify-between gap-3 border border-[var(--color-line)] p-4 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <CalendarClock aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" size={17} />
                  <span className="min-w-0">
                    <strong className="block">{formatAppointmentTime(clientHistory.upcoming.starts_at, business.timezone)}</strong>
                    <small className="text-[var(--color-ink-soft)]">{clientHistory.upcoming.services?.name ?? "Servicio"}</small>
                  </span>
                </span>
                <StatusBadge status={clientHistory.upcoming.status} />
              </div>
            ) : <p className="text-sm text-[var(--color-ink-soft)]">Sin turnos próximos.</p>}
          </section>

          <section aria-labelledby="historial-cliente" className="grid gap-3">
            <h3 className="text-sm font-semibold" id="historial-cliente">Historial</h3>
            {clientHistory.past.length > 0 ? (
              <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
                {clientHistory.past.map((appointment) => (
                  <li className="flex items-center justify-between gap-3 py-3 text-sm" key={appointment.id}>
                    <span className="min-w-0">
                      <strong className="block truncate">{appointment.services?.name ?? "Servicio"}</strong>
                      <small className="text-[var(--color-ink-soft)]">{formatAppointmentTime(appointment.starts_at, business.timezone)}</small>
                    </span>
                    <StatusBadge status={appointment.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[var(--color-ink-soft)]">Todavía no tiene turnos pasados.</p>}
          </section>
        </div> : null}
      </Drawer>

      <Drawer description="Creá una ficha básica para poder asignarle turnos manuales." onClose={() => setCreateOpen(false)} open={createOpen} title="Nuevo cliente" width="medium">
        <form className="grid gap-5" onSubmit={addClient}>
          <div className="grid h-12 w-12 place-items-center rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><UserRound aria-hidden="true" size={22} /></div>
          <Field label="Nombre" name="client_name" placeholder="Nombre y apellido" />
          <Field autoComplete="email" label="Email" name="client_email" placeholder="cliente@ejemplo.com" required={false} type="email" />
          <Field autoComplete="tel" label="Teléfono" name="client_phone" placeholder="11 2345 6789" required={false} />
          {message ? <FormMessage type="error">{message}</FormMessage> : null}
          <div className="sticky bottom-0 -mx-5 border-t border-[var(--color-line)] bg-white px-5 pt-5 sm:-mx-7 sm:px-7"><SubmitButton pending={pending}>Guardar cliente</SubmitButton></div>
        </form>
      </Drawer>
    </>
  );
}
