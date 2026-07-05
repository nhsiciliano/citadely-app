import { NextRequest } from "next/server";
import { insforgeAdmin } from "@/lib/insforge-admin";
import {
  getMercadoPagoAuthorizedPayment,
  getMercadoPagoPayment,
  getMercadoPagoPreapproval,
  verifyMercadoPagoSignature,
} from "@/lib/mercadopago";

type MercadoPagoWebhookBody = {
  type?: string;
  action?: string;
  date?: string;
  id?: string;
  data?: { id?: string };
};

export async function POST(request: NextRequest) {
  try {
    if (!insforgeAdmin) {
      return Response.json({ error: "InsForge admin no esta configurado." }, { status: 500 });
    }

    const body = (await request.json()) as MercadoPagoWebhookBody;
    const queryDataId = request.nextUrl.searchParams.get("data.id");
    const dataId = body.data?.id ?? queryDataId;

    const isValidSignature = verifyMercadoPagoSignature({
      dataId: queryDataId,
      requestId: request.headers.get("x-request-id"),
      signature: request.headers.get("x-signature"),
    });

    if (!isValidSignature) {
      return Response.json({ error: "Firma invalida." }, { status: 401 });
    }

    if (!dataId) {
      return Response.json({ received: true });
    }

    if (body.id === "123456" && body.data?.id === "123456" && body.date === "2021-11-01T02:02:02Z") {
      return Response.json({ received: true, simulated: true });
    }

    if (
      body.type === "preapproval" ||
      body.type === "subscription_preapproval" ||
      body.action?.includes("preapproval")
    ) {
      const preapproval = await getMercadoPagoPreapproval(dataId);
      const { error } = await insforgeAdmin.database.rpc("sync_business_subscription_status", {
        p_external_id: preapproval.id,
        p_status: preapproval.status,
        p_current_period_end: preapproval.next_payment_date ?? null,
      });

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({ received: true });
    }

    if (body.type === "subscription_authorized_payment") {
      const authorizedPayment = await getMercadoPagoAuthorizedPayment(dataId);
      const businessId = authorizedPayment.external_reference;

      if (!businessId) {
        return Response.json({ received: true, ignored: "missing_external_reference" });
      }

      const { error } = await insforgeAdmin.database.rpc("sync_business_subscription_payment", {
        p_business_id: businessId,
        p_status: authorizedPayment.payment?.status ?? authorizedPayment.status,
        p_current_period_end: null,
      });

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }

      return Response.json({ received: true });
    }

    if (body.type && body.type !== "payment") {
      return Response.json({ received: true });
    }

    const payment = await getMercadoPagoPayment(dataId);
    const paymentId = payment.external_reference;

    if (!paymentId) {
      return Response.json({ received: true, ignored: "missing_external_reference" });
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
      const { error } = await insforgeAdmin.database.rpc("sync_business_subscription_payment", {
        p_business_id: paymentId,
        p_status: payment.status,
        p_current_period_end: null,
      });

      if (!error) {
        return Response.json({ received: true });
      }
    }

    const { error } = await insforgeAdmin.database.rpc("confirm_mercadopago_payment", {
      p_payment_id: paymentId,
      p_external_id: String(payment.id),
      p_status: payment.status,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el webhook.";
    return Response.json({ error: message }, { status: 500 });
  }
}
