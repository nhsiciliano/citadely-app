"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Plus, TicketPercent } from "lucide-react";
import { AdminHeader, useLogout } from "@/components/admin/blog-admin";

type PromoCodeRow = {
  id: string;
  code_hint: string;
  duration_days: number;
  max_uses: number;
  uses: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Editing = { id: string; durationDays: number; maxUses: number; isActive: boolean };
const API = "/admin-panel/api/promo-codes";

async function parseResponse(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string; codes?: PromoCodeRow[] };
  if (!response.ok) throw new Error(body.error ?? "No se pudo completar la acción.");
  return body;
}

export function PromoCodesAdmin() {
  const logout = useLogout();
  const [codes, setCodes] = useState<PromoCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30);
  const [maxUses, setMaxUses] = useState(1);
  const [newCode, setNewCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCodes() {
    const body = await parseResponse(await fetch(API, { cache: "no-store" }));
    setCodes(body.codes ?? []);
  }

  useEffect(() => {
    void fetch(API, { cache: "no-store" }).then(parseResponse).then((body) => setCodes(body.codes ?? []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar los códigos."))
      .finally(() => setLoading(false));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage(""); setNewCode(""); setCopied(false);
    try {
      const body = await parseResponse(await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationDays: days, maxUses }),
      }));
      setNewCode(body.code ?? "");
      await loadCodes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el código.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(newCode);
      setCopied(true);
    } catch {
      setError("No se pudo copiar. Seleccioná el código y copialo manualmente.");
    }
  }

  async function update(row: Editing) {
    setBusy(true); setError(""); setMessage("");
    try {
      await parseResponse(await fetch(`${API}/${row.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      }));
      await loadCodes();
      setEditing(null);
      setMessage("Código actualizado. Los días ya otorgados no cambian.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(code: PromoCodeRow) {
    if (code.is_active && !window.confirm("¿Desactivar este código? Los accesos ya otorgados continúan vigentes.")) return;
    await update({ id: code.id, durationDays: code.duration_days, maxUses: code.max_uses, isActive: !code.is_active });
  }

  return <>
    <AdminHeader onLogout={logout} />
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex items-start gap-3 border-b border-[var(--color-line)] pb-7">
        <TicketPercent aria-hidden="true" className="mt-2 text-[var(--color-primary)]" size={28} />
        <div><p className="text-sm font-semibold text-[var(--color-primary)]">Acceso promocional</p><h1 className="font-display mt-2 text-4xl font-semibold text-[var(--color-navy)]">Códigos Pro</h1><p className="mt-2 text-[var(--color-ink-soft)]">Cada email registrado puede canjear un solo código. Acceso completo, sin cobro durante los días otorgados.</p></div>
      </div>

      <section className="mt-8 border border-[var(--color-line)] bg-white p-5 sm:p-7" aria-labelledby="crear-codigo">
        <h2 className="text-xl font-semibold" id="crear-codigo">Crear código</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">El código completo se muestra solo una vez. Copialo antes de salir.</p>
        <form method="post" className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(event) => void create(event)}>
          <label className="form-label">Días gratis<input className="form-control" max={365} min={1} onChange={(event) => setDays(Number(event.target.value))} required type="number" value={days} /></label>
          <label className="form-label">Cantidad de usos<input className="form-control" max={1000} min={1} onChange={(event) => setMaxUses(Number(event.target.value))} required type="number" value={maxUses} /></label>
          <button className="button-primary min-h-11" disabled={busy || Boolean(newCode) || days < 1 || days > 365 || maxUses < 1 || maxUses > 1000} type="submit"><Plus aria-hidden="true" size={17} />{busy ? "Guardando…" : "Crear código"}</button>
        </form>
        {newCode ? <div className="mt-6 border border-[var(--color-success)] bg-[var(--color-success-soft)] p-4" aria-live="polite"><p className="font-semibold">Código creado. Guardalo ahora.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="Código creado" className="form-control min-w-0 flex-1 font-mono text-sm" onFocus={(event) => event.currentTarget.select()} readOnly value={newCode} /><button className="button-secondary shrink-0" onClick={() => void copy()} type="button">{copied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}{copied ? "Copiado" : "Copiar código"}</button></div><button className="mt-3 text-sm font-semibold text-[var(--color-primary)] underline underline-offset-2" onClick={() => { setNewCode(""); setCopied(false); }} type="button">Ya lo guardé. Crear otro</button></div> : null}
      </section>

      {error ? <p className="mt-5 text-sm font-semibold text-[var(--color-danger)]" role="alert">{error}</p> : null}
      {message ? <p className="mt-5 text-sm font-semibold text-[var(--color-success)]" role="status">{message}</p> : null}

      <section className="mt-10" aria-labelledby="lista-codigos">
        <div className="flex items-end justify-between gap-4 border-b border-[var(--color-line)] pb-4"><h2 className="font-display text-2xl font-semibold" id="lista-codigos">Códigos creados</h2><span className="text-sm text-[var(--color-ink-muted)]">{codes.length} en total</span></div>
        {loading ? <p className="py-8 text-sm text-[var(--color-ink-soft)]">Cargando códigos…</p> : codes.length === 0 ? <p className="py-8 text-sm text-[var(--color-ink-soft)]">Todavía no hay códigos.</p> : <div className="divide-y divide-[var(--color-line)]">{codes.map((code) => {
          const edit = editing?.id === code.id ? editing : null;
          return <article className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" key={code.id}>
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-mono font-semibold">CTD-••••-{code.code_hint}</h3><span className={`status-badge ${code.is_active ? "status-confirmed" : "status-cancelled"}`}>{code.is_active ? "Activo" : "Desactivado"}</span></div><p className="mt-2 text-sm text-[var(--color-ink-soft)]">{code.duration_days} días · {code.uses} de {code.max_uses} usos · {Math.max(0, code.max_uses - code.uses)} disponibles</p></div>
            {edit ? <form method="post" className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void update(edit); }}><label className="form-label w-24">Días<input className="form-control" max={365} min={1} onChange={(event) => setEditing({ ...edit, durationDays: Number(event.target.value) })} required type="number" value={edit.durationDays} /></label><label className="form-label w-24">Cupo<input className="form-control" max={1000} min={Math.max(1, code.uses)} onChange={(event) => setEditing({ ...edit, maxUses: Number(event.target.value) })} required type="number" value={edit.maxUses} /></label><button className="button-primary" disabled={busy} type="submit">Guardar</button><button className="button-secondary" onClick={() => setEditing(null)} type="button">Cancelar</button></form> : <div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={busy} onClick={() => setEditing({ id: code.id, durationDays: code.duration_days, maxUses: code.max_uses, isActive: code.is_active })} type="button">Editar</button><button className="button-secondary" disabled={busy} onClick={() => void toggle(code)} type="button">{code.is_active ? "Desactivar" : "Reactivar"}</button></div>}
          </article>;
        })}</div>}
      </section>
    </main>
  </>;
}
