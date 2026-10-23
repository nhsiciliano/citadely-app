"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Building2, CreditCard, HeartHandshake, LogOut, MessageCircle } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { getErrorMessage } from "@/lib/auth";
import type { ContributionReturnResult } from "@/lib/contributions";
import { insforge } from "@/lib/insforge";
import { useWorkspace } from "../workspace-context";
import { PageHeader } from "../workspace-ui";

// contributionResult llega de ?aporte= al volver de Mercado Pago; lo usa la sección de aportes (C9).
export function SettingsScreen({ contributionResult }: { contributionResult: ContributionReturnResult | null }) {
  const { business, refresh, signOut, userEmail } = useWorkspace();
  const [paymentPending, setPaymentPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPaymentPending(true);
    setMessage(null);
    const { error } = await insforge.database.from("businesses").update({
      payment_alias: String(form.get("payment_alias") ?? ""),
      payment_cbu: String(form.get("payment_cbu") ?? ""),
      payment_instructions: String(form.get("payment_instructions") ?? ""),
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
      <PageHeader description="Administrá los datos para recibir señas, WhatsApp, el acceso a tu cuenta y tus aportes a Citadely." title="Configuración" />
      <div className="grid gap-6 px-5 py-6 sm:px-8 lg:px-10 lg:py-8 xl:grid-cols-2">
        {/* C9: <ContributionsSection result={contributionResult} /> reemplaza este bloque. */}
        <section className="surface-section xl:col-span-2" data-contribution-result={contributionResult ?? undefined} id="aportes">
          <div className="section-heading-row"><div><h2>Apoyá a Citadely</h2><p>Citadely es gratis para tu negocio.</p></div><HeartHandshake aria-hidden="true" className="text-primary" size={22} /></div>
        </section>

        <section className="surface-section">
          <div className="section-heading-row"><div><h2>Señas y transferencias</h2><p>Datos que verá el cliente al reservar.</p></div><CreditCard aria-hidden="true" className="text-primary" size={21} /></div>
          <form method="post" className="grid gap-4" onSubmit={savePayment}>
            <Field defaultValue={business.payment_alias ?? ""} label="Alias" name="payment_alias" placeholder="mi.alias" required={false} />
            <Field defaultValue={business.payment_cbu ?? ""} label="CBU o CVU" name="payment_cbu" placeholder="00000031000…" required={false} />
            <Field defaultValue={business.payment_instructions ?? ""} label="Instrucciones de pago" name="payment_instructions" placeholder="Indicaciones para enviar el comprobante" required={false} />
            <div className="flex items-center gap-2 border-t border-line pt-4"><MessageCircle aria-hidden="true" className="text-primary" size={18} /><h3 className="font-semibold">WhatsApp</h3></div>
            <div className="grid gap-2 text-sm">
              <span className="form-label">WhatsApp de contacto</span>
              <p className="text-ink-soft">
                {business.whatsapp_phone ? `+${business.whatsapp_phone}` : "Sin cargar"} · <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/negocio/pagina-publica">Editar en Página pública</Link>
              </p>
            </div>
            <SubmitButton pending={paymentPending}>Guardar configuración</SubmitButton>
          </form>
        </section>

        <section className="surface-section self-start">
          <div className="section-heading-row"><div><h2>Cuenta</h2><p>Información de acceso del responsable.</p></div><Building2 aria-hidden="true" className="text-primary" size={21} /></div>
          <dl className="divide-y divide-line border-y border-line text-sm">
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr]"><dt className="text-ink-muted">Negocio</dt><dd className="font-semibold">{business.name}</dd></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr]"><dt className="text-ink-muted">Email</dt><dd className="font-semibold">{userEmail}</dd></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr]"><dt className="text-ink-muted">Identificador</dt><dd className="font-mono text-xs">{business.id}</dd></div>
          </dl>
          <button className="button-secondary mt-6" onClick={signOut} type="button"><LogOut aria-hidden="true" size={17} />Cerrar sesión</button>
        </section>
        {message ? <div aria-live="polite" className="xl:col-span-2"><FormMessage type={messageType}>{message}</FormMessage></div> : null}
      </div>
    </>
  );
}
