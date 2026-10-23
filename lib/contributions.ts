// Aportes voluntarios por Mercado Pago (Checkout Pro). Sin server-only: lo usan la sección de
// configuración, la ruta de checkout y el webhook. Los límites coinciden con el CHECK de
// public.contributions (amount_cents entre 100000 y 50000000).

export const CONTRIBUTION_CURRENCY = "ARS";
export const CONTRIBUTION_MIN_CENTS = 100_000;
export const CONTRIBUTION_MAX_CENTS = 50_000_000;

export type ContributionStatus = "pending" | "approved" | "rejected" | "refunded" | "charged_back";

export type ContributionOption = {
  code: string;
  label: string;
  amount_cents: number;
  currency: string;
  sort_order: number;
};

export type Contribution = {
  id: string;
  business_id: string;
  amount_cents: number;
  currency: string;
  status: ContributionStatus;
  option_code: string | null;
  created_at: string;
  approved_at: string | null;
};

export type ContributionAmountInput = {
  optionCode?: unknown;
  amountCents?: unknown;
};

export type ParsedContributionAmount =
  | { ok: true; amountCents: number; optionCode: string | null }
  | { ok: false; error: string };

export function formatArs(amountCents: number) {
  return `$${(amountCents / 100).toLocaleString("es-AR")}`;
}

/**
 * Resuelve el importe de un aporte: un importe sugerido (optionCode, entre las opciones activas) o
 * uno libre en centavos, en pesos enteros y dentro de los límites. Si llega optionCode, manda la opción.
 */
export function parseContributionAmount(input: ContributionAmountInput, options: ContributionOption[]): ParsedContributionAmount {
  if (input.optionCode !== undefined && input.optionCode !== null && input.optionCode !== "") {
    const option = typeof input.optionCode === "string" ? options.find((item) => item.code === input.optionCode) : undefined;
    if (!option) return { ok: false, error: "Elegí un importe válido." };
    return { ok: true, amountCents: option.amount_cents, optionCode: option.code };
  }

  const amountCents = input.amountCents;
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents % 100 !== 0) {
    return { ok: false, error: "Ingresá un importe en pesos, sin centavos." };
  }
  if (amountCents < CONTRIBUTION_MIN_CENTS || amountCents > CONTRIBUTION_MAX_CENTS) {
    return {
      ok: false,
      error: `El aporte tiene que ser de entre ${formatArs(CONTRIBUTION_MIN_CENTS)} y ${formatArs(CONTRIBUTION_MAX_CENTS)}.`,
    };
  }
  return { ok: true, amountCents, optionCode: null };
}

/** Resultado con el que Mercado Pago vuelve a /negocio/configuracion (back_urls de la preferencia). */
export type ContributionReturnResult = "aprobado" | "pendiente" | "fallido";

export function parseContributionReturnResult(value: unknown): ContributionReturnResult | null {
  return value === "aprobado" || value === "pendiente" || value === "fallido" ? value : null;
}

const STATUS_LABELS: Record<ContributionStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  refunded: "Reembolsado",
  charged_back: "Contracargo",
};

export function contributionStatusLabel(status: ContributionStatus) {
  return STATUS_LABELS[status] ?? status;
}
