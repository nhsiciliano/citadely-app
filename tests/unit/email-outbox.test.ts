import { describe, expect, it } from "vitest";
import { renderOutboxEmail, type EmailOutboxRow } from "@/lib/email-outbox";

const contributionRow = (payload: Record<string, unknown>): EmailOutboxRow => ({
  id: "row-1",
  event_type: "contribution_received",
  recipient_kind: "user",
  recipient_email: "owner@test.com",
  reply_to: null,
  idempotency_key: "contribution_received:c-1",
  payload,
});

describe("lib/email-outbox", () => {
  it("contribution_received agradece el aporte con el importe y el negocio", async () => {
    const email = await renderOutboxEmail(contributionRow({
      amount_cents: 500000,
      currency: "ARS",
      business_name: "Clínica Norte",
      contribution_id: "c-1",
    }));

    expect(email.subject).toBe("¡Gracias por tu aporte a Citadely!");
    expect(email.attachments).toBeUndefined();
    expect(email.html).toContain("¡Gracias por tu aporte a Citadely!");
    expect(email.text).toMatch(/\$\s?5\.000/);
    expect(email.text).toContain("Clínica Norte");
    expect(email.text).toContain("no cambia las funciones");
    expect(email.html).toContain("/negocio/configuracion");
  });

  it("contribution_received omite el negocio si el payload no lo trae", async () => {
    const email = await renderOutboxEmail(contributionRow({ amount_cents: 1000000, currency: "ARS", business_name: null, contribution_id: "c-2" }));
    expect(email.text).toMatch(/\$\s?10\.000/);
    expect(email.text).not.toContain("Negocio");
  });
});
