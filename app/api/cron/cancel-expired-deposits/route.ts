import { NextRequest } from "next/server";
import { insforgeAdmin } from "@/lib/insforge-admin";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret && authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!insforgeAdmin) {
    return Response.json({ error: "InsForge admin no esta configurado." }, { status: 500 });
  }

  const { data, error } = await insforgeAdmin.database.rpc("cancel_expired_deposit_bookings");

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ cancelled: data ?? 0 });
}
