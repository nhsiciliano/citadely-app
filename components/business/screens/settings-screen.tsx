"use client";

import { useState, type FormEvent } from "react";
import { BadgeDollarSign, Building2, CalendarClock, Check, Clock3, CreditCard, Globe2, LogOut, MessageCircle, ShieldCheck, TicketPercent, XCircle } from "lucide-react";
import { Field, FormMessage, LoadingSpinner, SubmitButton } from "@/components/ui";
import { getErrorMessage } from "@/lib/auth";
import { getSubscriptionState } from "@/lib/citadely-db";
import { insforge } from "@/lib/insforge";
import { normalizeWhatsAppPhone } from "@/lib/public-profile";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from "@/lib/subscription-plans";
import { useWorkspace } from "../workspace-context";
import { PageHeader } from "../workspace-ui";

export function SettingsScreen() {
  const { business, refresh, signOut, userEmail } = useWorkspace();
  const subscription = getSubscriptionState(business);
  const [paymentPending, setPaymentPending] = useState(false);
  const [subscriptionPending, setSubscriptionPending] = useState(false);
  const [cancellationPending, setCancellationPending] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [requestedPlan, setRequestedPlan] = useState<SubscriptionPlanId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function redeemCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRedeeming(true);
    setMessage(null);
    const { data: session, error: sessionError } = await insforge.auth.refreshSession();
    if (sessionError || !session?.accessToken) {
      setRedeeming(false);
      setMessageType("error");
      setMessage("Tu sesión venció. Volvé a iniciar sesión para canjear el código.");
      return;
    }

    try {
      const response = await fetch("/api/promo-codes/redeem", {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: business.id, code: promoCode }),
      });
      const data = await response.json() as { startsAt?: string; endsAt?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo canjear el código.");
      setPromoCode("");
      await refresh();
      setMessageType("success");
      setMessage(`Código canjeado. Acceso Pro hasta el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(data.endsAt ?? ""))}.`);
    } catch (reason) {
      setMessageType("error");
      setMessage(reason instanceof Error ? reason.message : "No se pudo canjear el código.");
    } finally {
      setRedeeming(false);
    }
  }

  async function selectPlan(plan: SubscriptionPlanId) {
    setSubscriptionPending(true);
    setRequestedPlan(plan);
    setMessage(null);
    setMessageType("success");
    const { data: session, error: sessionError } = await insforge.auth.refreshSession();
    if (sessionError || !session?.accessToken) {
      setSubscriptionPending(false);
      setRequestedPlan(null);
      setMessageType("error");
      setMessage("Tu sesión venció. Volvé a iniciar sesión para cambiar el plan.");
      return;
    }

    const response = await fetch("/api/mercadopago/subscription", {
      method: "POST",
      headers: { "Authorization": `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: business.id, plan, requestId: crypto.randomUUID() }),
    });
    const data = (await response.json()) as { checkoutUrl?: string; changeScheduled?: boolean; unchanged?: boolean; awaitingFirstPayment?: boolean; effectiveAt?: string; error?: string };

    if (!response.ok) {
      setSubscriptionPending(false);
      setRequestedPlan(null);
      setMessageType("error");
      setMessage(data.error ?? "No se pudo actualizar el plan.");
      return;
    }

    if (data.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }

    await refresh();
    setSubscriptionPending(false);
    setRequestedPlan(null);
    setMessage(data.unchanged ? "Ya estás usando este plan." : data.awaitingFirstPayment ? "Plan elegido. Se activará cuando Mercado Pago confirme el primer cobro." : "Cambio programado para el próximo cobro aprobado.");
  }

  async function cancelSubscription() {
    const accessUntil = subscription.periodEndsAt
      ? new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(subscription.periodEndsAt)
      : null;
    const confirmation = window.confirm(
      accessUntil
        ? `¿Cancelar la renovación? Vas a conservar el acceso hasta el ${accessUntil}.`
        : "¿Cancelar la suscripción pendiente? No se realizará ningún cobro.",
    );
    if (!confirmation) return;

    setCancellationPending(true);
    setMessage(null);
    const { data: session, error: sessionError } = await insforge.auth.refreshSession();
    if (sessionError || !session?.accessToken) {
      setCancellationPending(false);
      setMessageType("error");
      setMessage("Tu sesión venció. Volvé a iniciar sesión para cancelar la suscripción.");
      return;
    }

    const response = await fetch("/api/mercadopago/subscription", {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: business.id, requestId: crypto.randomUUID() }),
    });
    const data = (await response.json()) as { cancelled?: boolean; unchanged?: boolean; cancelAt?: string | null; error?: string };

    if (!response.ok) {
      setCancellationPending(false);
      setMessageType("error");
      setMessage(data.error ?? "No se pudo cancelar la suscripción.");
      return;
    }

    await refresh();
    setCancellationPending(false);
    setMessageType("success");
    setMessage(data.cancelAt
      ? `Renovación cancelada. Conservás el acceso hasta el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(data.cancelAt))}.`
      : "Suscripción pendiente cancelada. No se realizará ningún cobro.");
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription.hasAccess) return;
    const form = new FormData(event.currentTarget);
    setPaymentPending(true);
    setMessage(null);
    const { error } = await insforge.database.from("businesses").update({
      payment_alias: String(form.get("payment_alias") ?? ""),
      payment_cbu: String(form.get("payment_cbu") ?? ""),
      payment_instructions: String(form.get("payment_instructions") ?? ""),
      whatsapp_phone: normalizeWhatsAppPhone(String(form.get("whatsapp_phone") ?? "")),
    }).eq("id", business.id);
    setPaymentPending(false);
    if (error) {
      setMessageType("error");
      setMessage(getErrorMessage(error));
    }
    else {
      setMessageType("success");
      setMessage("Configuración guardada.");
      await refresh();
    }
  }

  return (
    <>
      <PageHeader description="Administrá el plan, los datos para recibir señas, WhatsApp y el acceso a tu cuenta." title="Configuración" />
      <div className="grid gap-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8 xl:grid-cols-2">
        <section className="surface-section xl:col-span-2">
          <div className="section-heading-row"><div><h2>Plan y suscripción</h2><p>Elegí el acceso que necesita tu negocio.</p></div><BadgeDollarSign aria-hidden="true" className="text-[var(--color-primary)]" size={22} /></div>
          <div className="mb-6 grid border-y border-[var(--color-line)] md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div className="min-w-0 py-5 md:pe-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`status-badge ${subscription.hasPaidPeriod ? "status-confirmed" : subscription.isTrialing || subscription.awaitingFirstPayment ? "status-pending_payment" : "status-cancelled"}`}>
                  {subscription.hasPromotion
                    ? "Acceso Pro promocional"
                    : subscription.cancelAtPeriodEnd
                    ? "Renovación cancelada"
                    : subscription.isPastDue
                      ? "Pago pendiente"
                      : subscription.hasPaidPeriod
                        ? `Plan ${SUBSCRIPTION_PLANS[subscription.currentPlan].name}`
                        : subscription.isTrialing
                          ? "Prueba Pro activa"
                          : "Pago requerido"}
                </span>
                {subscription.cancelAtPeriodEnd && subscription.periodEndsAt ? (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-danger)]"><XCircle aria-hidden="true" size={16} />Acceso hasta el {new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(subscription.periodEndsAt)}</span>
                ) : null}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-ink-soft)]">
                {subscription.hasPromotion && subscription.promotionEndsAt
                  ? `Todas las funciones Pro sin cargo hasta el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(subscription.promotionEndsAt)}. Si elegís un plan, el primer cobro será después de esa fecha.`
                  : subscription.isTrialing
                  ? `${subscription.trialDaysLeft} días restantes con todas las funciones Pro.${subscription.promotionPending && subscription.promotionEndsAt ? ` Después tendrás acceso promocional hasta el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(subscription.promotionEndsAt)}.` : " Si elegís un plan ahora, el primer cobro se hará al terminar la prueba."}`
                  : subscription.isPastDue && subscription.hasPaidPeriod
                    ? "Mercado Pago no pudo completar la renovación. Conservás el acceso durante el período ya abonado."
                    : subscription.hasPaidPeriod
                      ? "Tu dashboard está habilitado y la renovación es mensual."
                      : "Elegí un plan y completá la autorización en Mercado Pago para recuperar el acceso."}
              </p>
              {subscription.pendingPlan ? (
                <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                  <Clock3 aria-hidden="true" size={16} />
                  {subscription.awaitingFirstPayment ? "Primer cobro" : `Cambio a ${SUBSCRIPTION_PLANS[subscription.pendingPlan].name}`}
                  {subscription.promotionEndsAt && subscription.promotionEndsAt > new Date()
                    ? ` el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(subscription.promotionEndsAt)}`
                    : subscription.isTrialing
                    ? ` el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(business.trial_ends_at))}`
                    : business.subscription_current_period_end
                      ? ` el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(business.subscription_current_period_end))}`
                      : " cuando se apruebe el pago"}
                </span>
              ) : null}
            </div>
            <dl className="grid content-center gap-3 border-t border-[var(--color-line)] py-5 text-sm md:border-s md:border-t-0 md:ps-6">
              <div className="flex items-center justify-between gap-4"><dt className="text-[var(--color-ink-muted)]">Importe actual</dt><dd className="font-mono font-semibold tabular-nums">{subscription.hasPromotion || subscription.promotionPending ? "Sin cargo" : `$${(SUBSCRIPTION_PLANS[subscription.currentPlan].priceCents / 100).toLocaleString("es-AR")} ARS`}</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-[var(--color-ink-muted)]">Frecuencia</dt><dd className="font-semibold">Mensual</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-[var(--color-ink-muted)]">Próxima fecha</dt><dd className="text-end font-semibold">{subscription.promotionEndsAt && subscription.promotionEndsAt > new Date() ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(subscription.promotionEndsAt) : subscription.periodEndsAt ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(subscription.periodEndsAt) : subscription.isTrialing ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(business.trial_ends_at)) : "Al aprobarse"}</dd></div>
            </dl>
          </div>
          <div className="mb-6 border border-[var(--color-line)] bg-[var(--color-surface-subtle)] p-5">
            <div className="flex items-start gap-3"><TicketPercent aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" size={20} /><div><h3 className="font-semibold">Código de acceso Pro</h3><p className="mt-1 text-sm text-[var(--color-ink-soft)]">Cada email puede usar un código una sola vez. Incluye página pública y reservas.</p></div></div>
            {business.promotion_ends_at ? <p className="mt-4 text-sm font-semibold">Código utilizado. Acceso otorgado hasta el {new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(business.promotion_ends_at))}.</p> : <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void redeemCode(event)}><label className="form-label min-w-0 flex-1">Ingresá tu código<input autoComplete="off" className="form-control font-mono" maxLength={80} onChange={(event) => setPromoCode(event.target.value)} placeholder="CTD-XXXX-XXXX-..." required type="text" value={promoCode} /></label><button className="button-secondary shrink-0" disabled={redeeming || !promoCode.trim() || subscription.hasPaidPeriod || Boolean(business.subscription_external_id && !business.subscription_cancel_at_period_end)} type="submit">{redeeming ? "Validando…" : "Canjear código"}</button></form>}
            {!business.promotion_ends_at && (subscription.hasPaidPeriod || (business.subscription_external_id && !business.subscription_cancel_at_period_end)) ? <p className="mt-3 text-xs text-[var(--color-ink-muted)]">Para canjearlo, cancelá la suscripción y esperá a que termine el período pagado.</p> : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(Object.values(SUBSCRIPTION_PLANS) as (typeof SUBSCRIPTION_PLANS)[SubscriptionPlanId][]).map((plan) => {
              const isCurrent = business.subscription_status === "active" && subscription.currentPlan === plan.id && !subscription.pendingPlan;
              const isPending = subscription.pendingPlan === plan.id;
              const isLoading = subscriptionPending && requestedPlan === plan.id;
              return (
                <article className={`border p-5 ${isCurrent || isPending ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-line)] bg-white"}`} key={plan.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="text-xl font-semibold">{plan.name}</h3><p className="mt-1 text-sm leading-6 text-[var(--color-ink-soft)]">{plan.description}</p></div>
                    {plan.publicPage ? <Globe2 aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" size={22} /> : <Building2 aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" size={22} />}
                  </div>
                  <p className="mt-5 text-3xl font-semibold tracking-[-0.03em]">${(plan.priceCents / 100).toLocaleString("es-AR")} <span className="text-sm font-medium text-[var(--color-ink-muted)]">ARS/mes</span></p>
                  <ul className="mt-5 grid gap-2 text-sm">{plan.features.map((feature) => <li className="flex gap-2" key={feature}><Check aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" size={16} />{feature}</li>)}</ul>
                  <button aria-busy={isLoading} className={plan.id === "pro" ? "button-primary mt-6 w-full" : "button-secondary mt-6 w-full"} disabled={subscriptionPending || cancellationPending || (isCurrent && !subscription.cancelAtPeriodEnd) || isPending} onClick={() => void selectPlan(plan.id)} type="button">{isLoading ? <LoadingSpinner label={`Procesando cambio al plan ${plan.name}`} /> : <><CreditCard aria-hidden="true" size={17} />{subscription.cancelAtPeriodEnd && subscription.currentPlan === plan.id ? "Reactivar renovación" : isCurrent ? "Plan actual" : isPending ? "Cambio programado" : subscription.hasPaidPeriod ? `Cambiar a ${plan.name}` : `Elegir ${plan.name}`}</>}</button>
                </article>
              );
            })}
          </div>
          {business.subscription_checkout_url && subscription.awaitingFirstPayment ? (
            <div className="mt-5 flex flex-col gap-3 border border-[var(--color-line)] bg-[var(--color-surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3"><CalendarClock aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" size={19} /><div><p className="font-semibold">Autorización pendiente</p><p className="mt-1 text-sm text-[var(--color-ink-soft)]">Terminá el proceso en Mercado Pago. El acceso pago se habilita únicamente cuando recibamos la confirmación.</p></div></div>
              <a className="button-secondary shrink-0" href={business.subscription_checkout_url}>Continuar en Mercado Pago</a>
            </div>
          ) : null}
          {!business.subscription_checkout_url && business.subscription_external_id && subscription.awaitingFirstPayment ? (
            <div className="mt-5 flex gap-3 border border-[var(--color-success)] bg-[var(--color-success-soft)] p-4">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-success)]" size={19} />
              <div><p className="font-semibold">Medio de pago autorizado</p><p className="mt-1 text-sm text-[var(--color-ink-soft)]">Mercado Pago confirmó la autorización. El plan pago se activará únicamente cuando recibamos el primer cobro aprobado.</p></div>
            </div>
          ) : null}
          {business.subscription_external_id && !subscription.cancelAtPeriodEnd ? (
            <div className="mt-5 flex flex-col gap-3 border-t border-[var(--color-line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-success)]" size={19} /><div><p className="font-semibold">Cobro protegido por Mercado Pago</p><p className="mt-1 text-sm text-[var(--color-ink-soft)]">Podés cancelar la renovación sin perder el período que ya pagaste.</p></div></div>
              <button aria-busy={cancellationPending} className="button-secondary shrink-0 text-[var(--color-danger)]" disabled={subscriptionPending || cancellationPending} onClick={() => void cancelSubscription()} type="button">{cancellationPending ? <LoadingSpinner label="Cancelando renovación" /> : <><XCircle aria-hidden="true" size={17} />Cancelar renovación</>}</button>
            </div>
          ) : null}
        </section>

        <section className="surface-section">
          <div className="section-heading-row"><div><h2>Señas y transferencias</h2><p>Datos que verá el cliente al reservar.</p></div><CreditCard aria-hidden="true" className="text-[var(--color-primary)]" size={21} /></div>
          <form className="grid gap-4" onSubmit={savePayment}>
            <Field defaultValue={business.payment_alias ?? ""} label="Alias" name="payment_alias" placeholder="mi.alias" required={false} />
            <Field defaultValue={business.payment_cbu ?? ""} label="CBU o CVU" name="payment_cbu" placeholder="00000031000…" required={false} />
            <Field defaultValue={business.payment_instructions ?? ""} label="Instrucciones de pago" name="payment_instructions" placeholder="Indicaciones para enviar el comprobante" required={false} />
            <div className="flex items-center gap-2 border-t border-[var(--color-line)] pt-4"><MessageCircle aria-hidden="true" className="text-[var(--color-primary)]" size={18} /><h3 className="font-semibold">WhatsApp</h3></div>
            <Field defaultValue={business.whatsapp_phone ?? ""} label="Número para comprobantes" name="whatsapp_phone" placeholder="5491123456789" required={false} />
            <p className="text-xs leading-5 text-[var(--color-ink-muted)]">Ingresalo con código de país, sin +, espacios ni guiones.</p>
            {!subscription.hasAccess ? <FormMessage type="error">Activá el plan mensual para modificar estos datos.</FormMessage> : null}
            <SubmitButton disabled={!subscription.hasAccess} pending={paymentPending}>Guardar configuración</SubmitButton>
          </form>
        </section>

        <section className="surface-section self-start">
          <div className="section-heading-row"><div><h2>Cuenta</h2><p>Información de acceso del responsable.</p></div><Building2 aria-hidden="true" className="text-[var(--color-primary)]" size={21} /></div>
          <dl className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)] text-sm">
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr]"><dt className="text-[var(--color-ink-muted)]">Negocio</dt><dd className="font-semibold">{business.name}</dd></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr]"><dt className="text-[var(--color-ink-muted)]">Email</dt><dd className="font-semibold">{userEmail}</dd></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr]"><dt className="text-[var(--color-ink-muted)]">Identificador</dt><dd className="font-mono text-xs">{business.id}</dd></div>
          </dl>
          <button className="button-secondary mt-6" onClick={signOut} type="button"><LogOut aria-hidden="true" size={17} />Cerrar sesión</button>
        </section>
        {message ? <div aria-live="polite" className="xl:col-span-2"><FormMessage type={messageType}>{message}</FormMessage></div> : null}
      </div>
    </>
  );
}
