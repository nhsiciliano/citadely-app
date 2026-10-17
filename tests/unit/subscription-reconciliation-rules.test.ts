import { describe, expect, it } from "vitest";
import type { MercadoPagoAuthorizedPaymentResponse, MercadoPagoPreapprovalResponse } from "@/lib/mercadopago";
import { classifyOrphanPreapprovals, ORPHAN_PENDING_MAX_AGE_MS, selectInvoicesToApply } from "@/lib/subscription-reconciliation-rules";

// payment.id es numérico en Mercado Pago; acá se usan ids legibles para las aserciones.
function invoice(id: number, paymentStatus: string | null, date: string): MercadoPagoAuthorizedPaymentResponse {
  return {
    id,
    status: paymentStatus ? "processed" : "scheduled",
    ...(paymentStatus ? { payment: { id: `pay-${id}` as unknown as number, status: paymentStatus } } : {}),
    transaction_amount: 18000,
    currency_id: "ARS",
    date_created: date,
  };
}

describe("selectInvoicesToApply", () => {
  it("applies approvals, refunds and chargebacks not yet recorded, oldest first", () => {
    const result = selectInvoicesToApply([
      invoice(2, "refunded", "2026-10-02T00:00:00Z"),
      invoice(1, "approved", "2026-09-02T00:00:00Z"),
      invoice(3, "charged_back", "2026-10-03T00:00:00Z"),
    ], new Map());
    expect(result.map((item) => [item.providerPaymentId, item.status])).toEqual([
      ["pay-1", "approved"],
      ["pay-2", "refunded"],
      ["pay-3", "charged_back"],
    ]);
    expect(result[0]).toMatchObject({ amount: 18000, currency: "ARS", paidAt: "2026-09-02T00:00:00Z" });
  });

  it("skips payments already recorded with the same status", () => {
    const invoices = [invoice(1, "approved", "2026-09-02T00:00:00Z"), invoice(2, "refunded", "2026-10-02T00:00:00Z")];
    expect(selectInvoicesToApply(invoices, new Map([["pay-1", "approved"], ["pay-2", "approved"]])).map((item) => item.providerPaymentId)).toEqual(["pay-2"]);
  });

  it("only applies a rejection when it is the latest charge", () => {
    const retriedAndPaid = [invoice(1, "rejected", "2026-10-01T00:00:00Z"), invoice(2, "approved", "2026-10-03T00:00:00Z")];
    expect(selectInvoicesToApply(retriedAndPaid, new Map()).map((item) => item.status)).toEqual(["approved"]);

    const latestRejected = [invoice(1, "approved", "2026-09-01T00:00:00Z"), invoice(2, "rejected", "2026-10-01T00:00:00Z")];
    expect(selectInvoicesToApply(latestRejected, new Map([["pay-1", "approved"]])).map((item) => item.status)).toEqual(["rejected"]);
  });

  it("ignores scheduled invoices without a payment and in-progress payments", () => {
    expect(selectInvoicesToApply([
      invoice(1, null, "2026-11-01T00:00:00Z"),
      invoice(2, "in_process", "2026-10-01T00:00:00Z"),
    ], new Map())).toEqual([]);
  });
});

describe("classifyOrphanPreapprovals", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  const old = new Date(now - ORPHAN_PENDING_MAX_AGE_MS - 60_000).toISOString();
  const fresh = new Date(now - 60_000).toISOString();
  const preapproval = (id: string, status: string, extra: Partial<MercadoPagoPreapprovalResponse> = {}): MercadoPagoPreapprovalResponse => ({
    id,
    status,
    reason: "Citadely - Plan Pro",
    external_reference: "business-1",
    date_created: old,
    ...extra,
  });

  it("cancels old pending orphans and reports authorized or paused ones", () => {
    const result = classifyOrphanPreapprovals([
      preapproval("old-pending", "pending"),
      preapproval("fresh-pending", "pending", { date_created: fresh }),
      preapproval("authorized", "authorized"),
      preapproval("paused", "paused"),
      preapproval("cancelled", "cancelled"),
    ], new Set(), new Set(["business-1"]), now);
    expect(result.cancel.map((item) => item.id)).toEqual(["old-pending"]);
    expect(result.report.map((item) => item.id)).toEqual(["authorized", "paused"]);
  });

  it("skips linked preapprovals, duplicates and subscriptions that are not Citadely's", () => {
    const result = classifyOrphanPreapprovals([
      preapproval("linked", "authorized"),
      preapproval("dup", "authorized"),
      preapproval("dup", "authorized"),
      preapproval("other-app", "authorized", { reason: "Otro producto", external_reference: "ajeno" }),
      preapproval("known-business", "authorized", { reason: "Otro texto" }),
    ], new Set(["linked"]), new Set(["business-1"]), now);
    expect(result.cancel).toEqual([]);
    expect(result.report.map((item) => item.id)).toEqual(["dup", "known-business"]);
  });

  it("does not cancel pending orphans without a creation date", () => {
    const result = classifyOrphanPreapprovals([preapproval("no-date", "pending", { date_created: undefined })], new Set(), new Set(["business-1"]), now);
    expect(result).toEqual({ cancel: [], report: [] });
  });
});
