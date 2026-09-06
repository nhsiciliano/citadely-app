"use client";

import { useState, type FormEvent } from "react";
import { BadgeDollarSign, Building2, CreditCard, LogOut, MessageCircle } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { getErrorMessage } from "@/lib/auth";
import { getSubscriptionState } from "@/lib/citadely-db";
import { insforge } from "@/lib/insforge";
import { useWorkspace } from "../workspace-context";
import { PageHeader } from "../workspace-ui";

function normalizePhone(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export function SettingsScreen() {
  const { business, refresh, signOut, userEmail } = useWorkspace();
  const subscription = getSubscriptionState(business);
  const [paymentPending, setPaymentPending] = useState(false);
  const [subscriptionPending, setSubscriptionPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startSubscription() {
    setSubscriptionPending(true);
    setMessage(null);
    const response = await fetch("/api/mercadopago/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: business.id, payerEmail: userEmail }) });
    const data = (await response.json()) as { externalId?: string; checkoutUrl?: string; error?: string };
    if (!response.ok || !data.externalId || !data.checkoutUrl) {
      setSubscriptionPending(false);
      setMessage(data.error ?? "No se pudo iniciar la suscripción mensual.");
      return;
    }
    const { error } = await insforge.database.rpc("set_business_subscription_checkout", { p_business_id: business.id, p_external_id: data.externalId, p_checkout_url: data.checkoutUrl });
    if (error) {
      setSubscriptionPending(false);
      setMessage(getErrorMessage(error));
      return;
    }
    await refresh();
    window.location.href = data.checkoutUrl;
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
      whatsapp_phone: normalizePhone(form.get("whatsapp_phone")),
    }).eq("id", business.id);
    setPaymentPending(false);
    if (error) setMessage(getErrorMessage(error));
    else {
      setMessage("Configuración guardada.");
      await refresh();
    }
  }

  return (
    <>
      <PageHeader description="Administrá el plan, los datos para recibir señas, WhatsApp y el acceso a tu cuenta." title="Configuración" />
      <div className="grid gap-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8 xl:grid-cols-2">
        <section className="surface-section xl:col-span-2">
          <div className="section-heading-row"><div><h2>Plan y suscripción</h2><p>Estado de acceso y próximo paso de facturación.</p></div><BadgeDollarSign aria-hidden="true" className="text-[var(--color-primary)]" size={22} /></div>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className={`status-badge ${business.subscription_status === "active" ? "status-confirmed" : subscription.isTrialing ? "status-pending_payment" : "status-cancelled"}`}>{business.subscription_status === "active" ? "Plan activo" : subscription.isTrialing ? "Prueba activa" : "Pago requerido"}</span>
              <h3 className="mt-4 text-xl font-semibold">{subscription.isTrialing ? `${subscription.trialDaysLeft} días de prueba disponibles` : business.subscription_status === "active" ? "Suscripción mensual activa" : "Tu prueba gratuita finalizó"}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-ink-soft)]">{subscription.isTrialing ? "Usá todas las funciones sin restricciones. Luego el plan cuesta $15.000 ARS por mes." : business.subscription_status === "active" ? "El plan cuesta $15.000 ARS por mes y mantiene activa tu página de reservas." : "Activá la suscripción mensual de $15.000 ARS para volver a crear servicios y recibir reservas."}</p>
            </div>
            {business.subscription_status !== "active" ? <button className="button-primary" disabled={subscriptionPending} onClick={startSubscription} type="button"><CreditCard aria-hidden="true" size={18} />{subscriptionPending ? "Abriendo Mercado Pago…" : "Activar plan mensual"}</button> : null}
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
        {message ? <div className="xl:col-span-2"><FormMessage type={message.includes("guardada") ? "success" : "error"}>{message}</FormMessage></div> : null}
      </div>
    </>
  );
}
