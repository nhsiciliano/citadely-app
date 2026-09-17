"use client";

import { useState, type FormEvent } from "react";
import { BadgeDollarSign, Building2, Check, Clock3, CreditCard, Globe2, LogOut, MessageCircle } from "lucide-react";
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
  const [requestedPlan, setRequestedPlan] = useState<SubscriptionPlanId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

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
      body: JSON.stringify({ businessId: business.id, plan }),
    });
    const data = (await response.json()) as { checkoutUrl?: string; changeScheduled?: boolean; unchanged?: boolean; cancelledPending?: boolean; error?: string };

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
    setMessage(data.unchanged ? "Ya estás usando este plan." : data.cancelledPending ? "Cambio pendiente cancelado." : "Cambio programado para el próximo cobro aprobado.");
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
          <div className="mb-6 flex flex-wrap items-center gap-3 border-y border-[var(--color-line)] py-4">
            <span className={`status-badge ${business.subscription_status === "active" ? "status-confirmed" : subscription.isTrialing ? "status-pending_payment" : "status-cancelled"}`}>{business.subscription_status === "active" ? `Plan ${SUBSCRIPTION_PLANS[subscription.currentPlan].name}` : subscription.isTrialing ? "Prueba Pro activa" : "Pago requerido"}</span>
            <p className="text-sm text-[var(--color-ink-soft)]">{subscription.isTrialing ? `${subscription.trialDaysLeft} días restantes con todas las funciones Pro.` : business.subscription_status === "active" ? "Dashboard habilitado." : "Elegí un plan para recuperar el acceso."}</p>
            {subscription.pendingPlan ? <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]"><Clock3 aria-hidden="true" size={16} />Cambio a {SUBSCRIPTION_PLANS[subscription.pendingPlan].name}{business.subscription_current_period_end ? ` el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(business.subscription_current_period_end))}` : " en el próximo cobro"}</span> : null}
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
                  <button aria-busy={isLoading} className={plan.id === "pro" ? "button-primary mt-6 w-full" : "button-secondary mt-6 w-full"} disabled={subscriptionPending || isCurrent || isPending} onClick={() => void selectPlan(plan.id)} type="button">{isLoading ? <LoadingSpinner label={`Procesando cambio al plan ${plan.name}`} /> : <><CreditCard aria-hidden="true" size={17} />{isCurrent ? "Plan actual" : isPending ? "Cambio programado" : business.subscription_status === "active" ? `Cambiar a ${plan.name}` : `Elegir ${plan.name}`}</>}</button>
                </article>
              );
            })}
          </div>
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
        {message ? <div className="xl:col-span-2"><FormMessage type={messageType}>{message}</FormMessage></div> : null}
      </div>
    </>
  );
}
