import type { MercadoPagoAuthorizedPaymentResponse, MercadoPagoPreapprovalResponse } from "@/lib/mercadopago";

// Reglas puras de la reconciliación con Mercado Pago (sin red ni base): qué cobros aplicar
// y qué suscripciones quedaron huérfanas.

const SETTLED_STATUSES = new Set(["approved", "refunded", "charged_back"]);
const FAILED_STATUSES = new Set(["rejected", "cancelled"]);
const OPEN_PREAPPROVAL_STATUSES = new Set(["pending", "authorized", "paused"]);

export const ORPHAN_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type InvoiceToApply = {
  providerPaymentId: string;
  status: string;
  amount: number | undefined;
  currency: string | undefined;
  paidAt: string | undefined;
};

function invoiceTime(invoice: MercadoPagoAuthorizedPaymentResponse) {
  const value = Date.parse(invoice.date_approved ?? invoice.date_created ?? "");
  return Number.isFinite(value) ? value : 0;
}

/**
 * Cobros de una suscripción que la base todavía no refleja. Solo cuentan los que tienen un pago real
 * (las facturas programadas o canceladas sin cobro no cambian el acceso). Aprobaciones, reembolsos y
 * contracargos se aplican siempre (la RPC es idempotente); un rechazo solo si es el cobro más reciente,
 * para que un intento fallido viejo no pase a mora un período que después se pagó.
 */
export function selectInvoicesToApply(
  invoices: readonly MercadoPagoAuthorizedPaymentResponse[],
  recordedStatuses: ReadonlyMap<string, string>,
): InvoiceToApply[] {
  const charged = invoices
    .filter((invoice) => invoice.payment?.id != null && invoice.payment.status)
    .sort((left, right) => invoiceTime(left) - invoiceTime(right));
  const latest = charged.at(-1);

  return charged.flatMap((invoice) => {
    const providerPaymentId = String(invoice.payment!.id);
    const status = invoice.payment!.status!;
    if (recordedStatuses.get(providerPaymentId) === status) return [];
    if (!SETTLED_STATUSES.has(status) && !(FAILED_STATUSES.has(status) && invoice === latest)) return [];
    return [{
      providerPaymentId,
      status,
      amount: invoice.transaction_amount,
      currency: invoice.currency_id,
      paidAt: invoice.date_approved ?? invoice.date_created,
    }];
  });
}

export type OrphanClassification = {
  /** Pendientes viejas sin negocio vinculado: nadie va a completar ese checkout. */
  cancel: MercadoPagoPreapprovalResponse[];
  /** Autorizadas o pausadas sin vincular: pueden estar cobrando a un cliente sin darle acceso. */
  report: MercadoPagoPreapprovalResponse[];
};

/**
 * Suscripciones abiertas de Citadely en Mercado Pago que ningún negocio tiene vinculadas
 * (por ejemplo, si el proceso cayó entre crear la preapproval y guardarla en el negocio).
 */
export function classifyOrphanPreapprovals(
  preapprovals: readonly MercadoPagoPreapprovalResponse[],
  linkedPreapprovalIds: ReadonlySet<string>,
  knownBusinessIds: ReadonlySet<string>,
  now = Date.now(),
): OrphanClassification {
  const result: OrphanClassification = { cancel: [], report: [] };
  const seen = new Set<string>();

  for (const preapproval of preapprovals) {
    if (seen.has(preapproval.id)) continue;
    seen.add(preapproval.id);
    if (!OPEN_PREAPPROVAL_STATUSES.has(preapproval.status) || linkedPreapprovalIds.has(preapproval.id)) continue;
    const isCitadely = (preapproval.external_reference && knownBusinessIds.has(preapproval.external_reference))
      || preapproval.reason?.startsWith("Citadely");
    if (!isCitadely) continue;

    if (preapproval.status === "pending") {
      const createdAt = Date.parse(preapproval.date_created ?? "");
      if (Number.isFinite(createdAt) && now - createdAt > ORPHAN_PENDING_MAX_AGE_MS) result.cancel.push(preapproval);
      continue;
    }
    result.report.push(preapproval);
  }

  return result;
}
