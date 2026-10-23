"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Clock3, CreditCard, HeartHandshake } from "lucide-react";
import { FormMessage, LoadingSpinner } from "@/components/ui";
import {
  contributionStatusLabel,
  formatArs,
  parseContributionAmount,
  type Contribution,
  type ContributionReturnResult,
  type ContributionStatus,
} from "@/lib/contributions";
import { isClientProduction } from "@/lib/env";
import { ensureFreshSession, insforge } from "@/lib/insforge";
import { useContributionOptions } from "./use-contribution-options";
import { useWorkspace } from "./workspace-context";

const CUSTOM = "custom";
const LIST_LIMIT = 20;
const LIST_COLUMNS = "id,business_id,amount_cents,currency,status,option_code,created_at,approved_at";
// Al volver aprobado, el webhook puede llegar unos segundos después que el usuario: se reintenta ~30 s.
const APPROVAL_POLL_DELAYS_MS = [2000, 3000, 5000, 8000, 13000];

const STATUS_BADGE: Record<ContributionStatus, string> = {
  pending: "status-pending_payment",
  approved: "status-confirmed",
  rejected: "status-cancelled",
  refunded: "status-no_show",
  charged_back: "status-no_show",
};

type ContributionList = { status: "loading" } | { status: "ready"; rows: Contribution[] } | { status: "error" };

// Lee la respuesta como JSON sin romper el flujo si el servidor responde algo que no lo es.
async function readJson<T extends object>(response: Response): Promise<Partial<T> & { error?: string }> {
  try {
    return (await response.json()) as Partial<T> & { error?: string };
  } catch {
    return { error: "La respuesta del servidor no es válida." } as Partial<T> & { error?: string };
  }
}

/** "5.000" o "5000" → centavos. Cualquier otra cosa (decimales, letras) queda como NaN y la rechaza la validación. */
function pesosToCents(value: string) {
  const digits = value.replace(/[.\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) * 100 : Number.NaN;
}

function isRecentApproval(row: Contribution) {
  return row.status === "approved" && Date.now() - Date.parse(row.created_at) < 60 * 60 * 1000;
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

/** result: ?aporte= con el que Mercado Pago vuelve a /negocio/configuracion (back_urls del checkout). */
export function ContributionsSection({ result }: { result: ContributionReturnResult | null }) {
  const { business } = useWorkspace();
  const optionsState = useContributionOptions();
  const options = optionsState.status === "ready" ? optionsState.options : [];
  const [selection, setSelection] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<ContributionList>({ status: "loading" });
  // La demo de producción es pública: no puede generar cobros. En Preview y local sí, para el E2E.
  const demoBlocked = isClientProduction && Boolean(business.is_demo);
  const selected = selection ?? options[0]?.code ?? (optionsState.status === "error" ? CUSTOM : null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function load() {
      // Los pendientes no se listan: incluyen checkouts abandonados que nunca llegaron a un pago.
      const { data, error: loadError } = await insforge.database
        .from("contributions")
        .select(LIST_COLUMNS)
        .eq("business_id", business.id)
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (cancelled) return;
      const rows = (data ?? []) as Contribution[];
      setList(loadError ? { status: "error" } : { status: "ready", rows });
      const delay = APPROVAL_POLL_DELAYS_MS[attempts];
      attempts += 1;
      if (result === "aprobado" && !loadError && !rows.some(isRecentApproval) && delay !== undefined) {
        timer = setTimeout(() => void load(), delay);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [business.id, result]);

  async function contribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoBlocked || !selected) return;
    const parsed = selected === CUSTOM
      ? parseContributionAmount({ amountCents: pesosToCents(customAmount) }, options)
      : parseContributionAmount({ optionCode: selected }, options);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setPending(true);
    setError(null);
    // Renueva la cookie de sesión antes de llamar a la ruta, que la lee del request.
    if (!(await ensureFreshSession())) {
      setPending(false);
      setError("Tu sesión venció. Volvé a iniciar sesión para hacer el aporte.");
      return;
    }

    const response = await fetch("/api/contributions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.optionCode
        ? { businessId: business.id, optionCode: parsed.optionCode }
        : { businessId: business.id, amountCents: parsed.amountCents }),
    }).catch(() => null);
    if (!response) {
      setPending(false);
      setError("No pudimos conectar con el servidor. Intentá de nuevo.");
      return;
    }
    const data = await readJson<{ contributionId?: string; checkoutUrl?: string }>(response);
    if (!response.ok || !data.checkoutUrl) {
      setPending(false);
      setError(data.error ?? "No pudimos iniciar el pago. Intentá de nuevo.");
      return;
    }
    // pending queda en true: la página se va a Mercado Pago.
    window.location.assign(data.checkoutUrl);
  }

  return (
    <section aria-labelledby="aportes-title" className="surface-section xl:col-span-2" id="aportes">
      <div className="section-heading-row">
        <div>
          <h2 id="aportes-title">Apoyá a Citadely</h2>
          <p>Citadely es gratis. Si te sirve, podés hacer un aporte voluntario: no desbloquea funciones, sostiene el proyecto.</p>
        </div>
        <HeartHandshake aria-hidden="true" className="shrink-0 text-primary" size={22} />
      </div>

      {result === "aprobado" ? (
        <div className="mb-5 flex gap-3 border border-success-line bg-success-soft p-4 text-sm" role="status">
          <CircleCheck aria-hidden="true" className="mt-0.5 shrink-0 text-success" size={19} />
          <div><p className="font-semibold text-success">¡Gracias por tu aporte!</p><p className="mt-1 text-ink-soft">Mercado Pago aprobó el pago. En unos segundos aparece en la lista.</p></div>
        </div>
      ) : result === "pendiente" ? (
        <div className="mb-5 flex gap-3 border border-warning/30 bg-warning-soft p-4 text-sm" role="status">
          <Clock3 aria-hidden="true" className="mt-0.5 shrink-0 text-warning" size={19} />
          <div><p className="font-semibold text-warning">Pago pendiente</p><p className="mt-1 text-ink-soft">Mercado Pago todavía no acreditó el pago. Cuando se apruebe, aparece en la lista.</p></div>
        </div>
      ) : result === "fallido" ? (
        <div className="mb-5 flex gap-3 border border-danger-line bg-danger-soft p-4 text-sm" role="alert">
          <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-danger" size={19} />
          <div><p className="font-semibold text-danger">El pago no se completó</p><p className="mt-1 text-ink-soft">Podés intentar de nuevo con otro medio de pago cuando quieras.</p></div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <form className="grid content-start gap-4" method="post" onSubmit={(event) => void contribute(event)}>
          <fieldset className="grid gap-3" disabled={pending || demoBlocked}>
            <legend className="form-label mb-3">Elegí un importe</legend>
            {optionsState.status === "loading" ? <p className="text-sm text-ink-muted">Cargando importes sugeridos…</p> : null}
            {optionsState.status === "error" ? <p className="text-sm text-ink-muted">No pudimos cargar los importes sugeridos. Podés ingresar otro importe.</p> : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {options.map((option) => (
                <label className="flex min-h-16 cursor-pointer flex-col justify-center rounded-md border border-line bg-white px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60" key={option.code}>
                  <input checked={selected === option.code} className="sr-only" name="contribution_option" onChange={() => { setSelection(option.code); setError(null); }} type="radio" value={option.code} />
                  <span className="font-mono text-lg font-semibold tabular-nums">{option.label}</span>
                  <span className="text-xs text-ink-muted">{option.currency}</span>
                </label>
              ))}
              {optionsState.status !== "loading" ? (
                <label className="flex min-h-16 cursor-pointer flex-col justify-center rounded-md border border-line bg-white px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                  <input checked={selected === CUSTOM} className="sr-only" name="contribution_option" onChange={() => { setSelection(CUSTOM); setError(null); }} type="radio" value={CUSTOM} />
                  <span className="text-sm font-semibold">Otro importe</span>
                  <span className="text-xs text-ink-muted">Entre $1.000 y $500.000</span>
                </label>
              ) : null}
            </div>
            {selected === CUSTOM ? (
              <label className="form-label max-w-xs">
                Importe en pesos
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="font-mono text-lg text-ink-muted">$</span>
                  <input autoComplete="off" className="form-control font-mono tabular-nums" inputMode="numeric" name="contribution_amount" onChange={(event) => { setCustomAmount(event.target.value); setError(null); }} placeholder="15.000" required type="text" value={customAmount} />
                </span>
              </label>
            ) : null}
          </fieldset>
          {error ? <FormMessage type="error">{error}</FormMessage> : null}
          {demoBlocked ? <p className="text-sm text-ink-muted">La cuenta demo no puede hacer aportes.</p> : null}
          <div>
            <button aria-busy={pending} className="button-primary w-full sm:w-auto" disabled={pending || demoBlocked || !selected} type="submit">
              {pending ? <LoadingSpinner label="Abriendo Mercado Pago" /> : <><CreditCard aria-hidden="true" size={17} />Aportar con Mercado Pago</>}
            </button>
            <p className="mt-3 text-xs leading-5 text-ink-muted">El pago se hace en Mercado Pago. Es un aporte único: no se repite ni se renueva.</p>
          </div>
        </form>

        <div className="min-w-0 border-t border-line pt-5 lg:border-s lg:border-t-0 lg:ps-6 lg:pt-0">
          <h3 className="font-semibold">Tus aportes</h3>
          {list.status === "loading" ? <p className="mt-3 text-sm text-ink-muted">Cargando…</p> : null}
          {list.status === "error" ? <p className="mt-3 text-sm text-danger">No pudimos cargar tus aportes.</p> : null}
          {list.status === "ready" && list.rows.length === 0 ? <p className="mt-3 text-sm text-ink-soft">Todavía no registramos aportes de tu negocio.</p> : null}
          {list.status === "ready" && list.rows.length > 0 ? (
            <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
              {list.rows.map((row) => (
                <li className="flex items-center justify-between gap-4 py-3" key={row.id}>
                  <div className="min-w-0">
                    <p className="font-mono font-semibold tabular-nums">{formatArs(row.amount_cents)} <span className="font-sans text-xs font-medium text-ink-muted">{row.currency}</span></p>
                    <p className="mt-0.5 text-xs text-ink-muted"><time dateTime={row.approved_at ?? row.created_at}>{dateFormatter.format(new Date(row.approved_at ?? row.created_at))}</time></p>
                  </div>
                  <span className={`status-badge shrink-0 ${STATUS_BADGE[row.status]}`}>{contributionStatusLabel(row.status)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
