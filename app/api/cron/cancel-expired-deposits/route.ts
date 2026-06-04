import { NextRequest } from "next/server";
import { insforgeServer } from "@/lib/insforge-server";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret && authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data, error } = await insforgeServer.database.rpc("cancel_expired_deposit_bookings");

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ cancelled: data ?? 0 });
}
