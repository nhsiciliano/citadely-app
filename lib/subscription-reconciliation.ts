import "server-only";

import type { InsForgeClient } from "@insforge/sdk";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  getMercadoPagoPreapproval,
  searchMercadoPagoAuthorizedPayments,
  searchMercadoPagoPreapprovals,
  updateMercadoPagoPreapproval,
  type MercadoPagoAuthorizedPaymentResponse,
  type MercadoPagoPreapprovalResponse,
} from "@/lib/mercadopago";
import { classifyOrphanPreapprovals, selectInvoicesToApply } from "@/lib/subscription-reconciliation-rules";

// Red de seguridad de los webhooks de Mercado Pago: vuelve a leer cada suscripción vinculada y sus cobros,
// aplica lo que la base no refleja y detecta suscripciones creadas en Mercado Pago que no quedaron vinculadas.

const CONCURRENCY = 4;
const SEARCH_PAGE_SIZE = 50;
const MAX_SEARCH_RESULTS = 1000;
const OPEN_STATUSES = ["pending", "authorized", "paused"] as const;

type LinkedBusiness = { id: string; subscription_external_id: string };

export type ReconciliationReport = {
  businesses: number;
  synced: number;
  paymentsApplied: number;
  errors: { businessId: string; message: string }[];
  orphans: {
    cancelled: string[];
    reported: { id: string; status: string; externalReference: string | null }[];
    searchError: string | null;
  };
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function listInvoices(preapprovalId: string) {
  const invoices: MercadoPagoAuthorizedPaymentResponse[] = [];
  for (let offset = 0; offset < MAX_SEARCH_RESULTS; offset += SEARCH_PAGE_SIZE) {
    const page = await searchMercadoPagoAuthorizedPayments(preapprovalId, { offset, limit: SEARCH_PAGE_SIZE });
    const results = page.results ?? [];
    invoices.push(...results);
    if (results.length < SEARCH_PAGE_SIZE) break;
  }
  return invoices;
}

async function listOpenPreapprovals() {
  const preapprovals: MercadoPagoPreapprovalResponse[] = [];
  for (const status of OPEN_STATUSES) {
    for (let offset = 0; offset < MAX_SEARCH_RESULTS; offset += SEARCH_PAGE_SIZE) {
      const page = await searchMercadoPagoPreapprovals({ status, offset, limit: SEARCH_PAGE_SIZE });
      const results = page.results ?? [];
      preapprovals.push(...results);
      if (results.length < SEARCH_PAGE_SIZE) break;
    }
  }
  return preapprovals;
}

async function reconcileBusiness(admin: InsForgeClient, business: LinkedBusiness) {
  const preapproval = await getMercadoPagoPreapproval(business.subscription_external_id);
  if (preapproval.external_reference && preapproval.external_reference !== business.id) {
    throw new Error("La referencia externa de la suscripcion no coincide con el negocio.");
  }

  const { error: syncError } = await admin.database.rpc("sync_business_subscription_status", {
    p_external_id: preapproval.id,
    p_status: preapproval.status,
    p_current_period_end: null,
  });
  if (syncError) throw new Error(syncError.message);

  const [invoices, recordedResult] = await Promise.all([
    listInvoices(preapproval.id),
    admin.database
      .from("subscription_payments")
      .select("provider_payment_id,status")
      .eq("business_id", business.id)
      .eq("subscription_external_id", preapproval.id),
  ]);
  if (recordedResult.error) throw new Error(recordedResult.error.message);
  const recorded = new Map(((recordedResult.data ?? []) as { provider_payment_id: string; status: string }[])
    .map((row) => [row.provider_payment_id, row.status]));

  let applied = 0;
  for (const invoice of selectInvoicesToApply(invoices, recorded)) {
    if (!Number.isFinite(invoice.amount)) throw new Error(`El cobro ${invoice.providerPaymentId} no informa importe.`);
    const { error } = await admin.database.rpc("apply_mercadopago_subscription_payment", {
      p_business_id: business.id,
      p_subscription_external_id: preapproval.id,
      p_provider_payment_id: invoice.providerPaymentId,
      p_status: invoice.status,
      p_amount_cents: Math.round(Number(invoice.amount) * 100),
      p_currency: invoice.currency ?? preapproval.auto_recurring?.currency_id ?? "ARS",
      p_paid_at: invoice.paidAt ?? null,
      p_current_period_end: preapproval.next_payment_date ?? null,
    });
    if (error) throw new Error(`Cobro ${invoice.providerPaymentId}: ${error.message}`);
    applied += 1;
  }
  return applied;
}

/** businessId limita la corrida a un negocio (soporte y tests); sin él se reconcilian todos. */
export async function reconcileSubscriptions(admin: InsForgeClient, { businessId }: { businessId?: string } = {}) {
  let query = admin.database
    .from("businesses")
    .select("id,subscription_external_id")
    .eq("subscription_provider", "mercadopago")
    .not("subscription_external_id", "is", null);
  if (businessId) query = query.eq("id", businessId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const businesses = (data ?? []) as LinkedBusiness[];

  const report: ReconciliationReport = {
    businesses: businesses.length,
    synced: 0,
    paymentsApplied: 0,
    errors: [],
    orphans: { cancelled: [], reported: [], searchError: null },
  };

  await mapWithConcurrency(businesses, CONCURRENCY, async (business) => {
    try {
      report.paymentsApplied += await reconcileBusiness(admin, business);
      report.synced += 1;
    } catch (reconcileError) {
      report.errors.push({ businessId: business.id, message: errorMessage(reconcileError) });
    }
  });

  try {
    let knownIds: Set<string>;
    if (businessId) {
      knownIds = new Set([businessId]);
    } else {
      const { data: ids, error: idsError } = await admin.database.from("businesses").select("id");
      if (idsError) throw new Error(idsError.message);
      knownIds = new Set(((ids ?? []) as { id: string }[]).map((row) => row.id));
    }
    const open = (await listOpenPreapprovals())
      .filter((preapproval) => !businessId || preapproval.external_reference === businessId);
    const linked = new Set(businesses.map((business) => business.subscription_external_id));
    const orphans = classifyOrphanPreapprovals(open, linked, knownIds);

    for (const preapproval of orphans.cancel) {
      try {
        await updateMercadoPagoPreapproval(preapproval.id, { status: "cancelled" });
        report.orphans.cancelled.push(preapproval.id);
      } catch (cancelError) {
        report.errors.push({ businessId: preapproval.external_reference ?? "", message: `Huérfana ${preapproval.id}: ${errorMessage(cancelError)}` });
      }
    }
    report.orphans.reported = orphans.report.map((preapproval) => ({
      id: preapproval.id,
      status: preapproval.status,
      externalReference: preapproval.external_reference ?? null,
    }));
  } catch (searchError) {
    report.orphans.searchError = errorMessage(searchError);
  }

  return report;
}
