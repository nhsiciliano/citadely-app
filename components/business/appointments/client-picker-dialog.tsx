"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Plus, Search, X } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { type Client } from "@/lib/citadely-db";
import { getClientSaveErrorMessage } from "@/lib/client-errors";
import { createClient } from "@/lib/clients";
import { READ_ONLY_HINT } from "@/lib/business-access";
import { useClientSearch } from "../use-client-search";
import { useWorkspace } from "../workspace-context";

export function ClientPickerDialog({ onClose, onClosed, onSelect, open }: { onClose: () => void; onClosed: () => void; onSelect: (client: Client) => void; open: boolean }) {
  const { access, business } = useWorkspace();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Búsqueda y paginación en el servidor: solo se consulta mientras el selector está abierto.
  const { clients: filteredClients, error: searchError, hasMore, loadMore, loading: searching, reload } = useClientSearch({ businessId: business.id, query, enabled: open });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      searchRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    if (pending) return;
    setCreating(false);
    setQuery("");
    setMessage(null);
    onClose();
  }

  function select(client: Client) {
    setQuery("");
    onSelect(client);
  }

  async function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage(null);
    const { data: created, error } = await createClient({
      businessId: business.id,
      name: String(form.get("client_name") ?? ""),
      email: String(form.get("client_email") ?? ""),
      phone: String(form.get("client_phone") ?? ""),
    });
    setPending(false);
    if (error || !created) {
      setMessage(error ? getClientSaveErrorMessage(error) : "No pudimos crear el cliente. Intentá nuevamente.");
      return;
    }
    onSelect(created as Client);
    setCreating(false);
    setQuery("");
    reload();
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className="client-picker-dialog m-auto max-h-[min(85dvh,760px)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto border border-line bg-white p-0 text-ink shadow-raised backdrop:bg-[rgba(4,20,42,.48)]"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={onClosed}
      ref={dialogRef}
      style={{ animation: "none" }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-7">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em]" id={titleId}>{creating ? "Nuevo cliente" : "Seleccionar cliente"}</h2>
          <p className="mt-1 text-sm text-ink-soft">{creating ? "Guardá la ficha para continuar con el turno." : "Buscá por nombre, email o teléfono."}</p>
        </div>
        <button aria-label="Cerrar selector de clientes" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line" disabled={pending} onClick={close} type="button"><X aria-hidden="true" size={19} /></button>
      </div>
      {creating ? (
        <form method="post" className="grid gap-5 px-5 py-6 sm:px-7" onSubmit={addClient}>
          <Field label="Nombre" name="client_name" placeholder="Nombre y apellido" />
          <Field autoComplete="email" label="Email" name="client_email" placeholder="cliente@ejemplo.com" required={false} type="email" />
          <Field autoComplete="tel" label="Teléfono" name="client_phone" placeholder="11 2345 6789" required={false} />
          {message ? <FormMessage type="error">{message}</FormMessage> : null}
          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={pending} onClick={() => { setCreating(false); setMessage(null); }} type="button">Volver a la lista</button>
            <div className="sm:w-48"><SubmitButton pending={pending}>Guardar cliente</SubmitButton></div>
          </div>
        </form>
      ) : (
        <div className="grid gap-5 px-5 py-6 sm:px-7">
          <label className="flex min-h-12 items-center gap-3 rounded-md border border-line px-4 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(9,87,217,0.1)]">
            <span className="sr-only">Buscar clientes</span>
            <Search aria-hidden="true" className="shrink-0 text-ink-muted" size={18} />
            <input className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-muted focus-visible:outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, email o teléfono" ref={searchRef} type="search" value={query} />
          </label>
          {filteredClients.length > 0 ? (
            <div className="max-h-[48dvh] overflow-auto border border-line">
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-surface-subtle text-xs font-semibold text-ink-soft"><tr><th className="px-4 py-3" scope="col">Nombre y apellido</th><th className="px-4 py-3" scope="col">Email</th><th className="px-4 py-3" scope="col">Teléfono</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {filteredClients.map((client) => <tr className="cursor-pointer hover:bg-primary-soft" key={client.id} onClick={() => select(client)}><td className="px-4 py-3"><button className="font-semibold text-primary underline-offset-2 hover:underline" type="button">{client.name}</button></td><td className="px-4 py-3 text-ink-soft">{client.email || "Sin email"}</td><td className="px-4 py-3 text-ink-soft">{client.phone || "Sin teléfono"}</td></tr>)}
                </tbody>
              </table>
            </div>
          ) : <div className="border border-dashed border-line-strong bg-surface-subtle px-5 py-8 text-center"><p className="font-semibold">{query ? "No encontramos coincidencias" : "Todavía no hay clientes"}</p><p className="mt-2 text-sm text-ink-soft">{query ? "Probá con otra búsqueda o creá un cliente." : "Creá el primer cliente para asignarle un turno."}</p></div>}
          {filteredClients.length > 0 ? <p className="text-xs text-ink-muted sm:hidden">Deslizá la tabla para ver todos los datos de contacto.</p> : null}
          {searchError ? <FormMessage type="error">{searchError}</FormMessage> : null}
          {hasMore ? <button className="button-secondary w-full sm:w-fit" disabled={searching} onClick={() => void loadMore()} type="button">{searching ? "Cargando…" : "Cargar más clientes"}</button> : null}
          <button className="button-secondary w-full sm:w-fit" disabled={!access.hasDashboardAccess} onClick={() => { setCreating(true); setMessage(null); }} title={access.hasDashboardAccess ? undefined : READ_ONLY_HINT} type="button"><Plus aria-hidden="true" size={18} />Crear nuevo cliente</button>
        </div>
      )}
    </dialog>
  );
}
