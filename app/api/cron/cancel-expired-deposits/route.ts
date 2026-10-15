import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { insforgeAdmin } from "@/lib/insforge-admin";

async function handle(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
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

// Vercel Cron sends GET; POST is kept for manual and legacy scheduler calls.
export { handle as GET, handle as POST };
