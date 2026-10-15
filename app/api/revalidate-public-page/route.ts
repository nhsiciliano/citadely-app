import { revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { publicPageTag } from "@/lib/public-page-data";

export const runtime = "nodejs";

// Called by the dashboard after the owner saves something that shows on the public page.
// Best effort: the page also refreshes by itself every PUBLIC_PAGE_REVALIDATE_SECONDS.
export async function POST(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!accessToken || !baseUrl) return Response.json({ error: "Sesión requerida." }, { status: 401 });
  if (!insforgeAdmin) return Response.json({ error: "InsForge admin no está configurado." }, { status: 500 });

  const userClient = createClient({ baseUrl, ...(anonKey ? { anonKey } : {}), isServerMode: true });
  userClient.setAccessToken(accessToken);
  const { data: authData, error: authError } = await userClient.auth.getCurrentUser();
  const user = authData?.user;
  if (authError || !user) return Response.json({ error: "Sesión inválida." }, { status: 401 });

  // The tag comes from the caller's own business, never from the request body.
  const { data: rows, error } = await insforgeAdmin.database.from("businesses").select("slug").eq("owner_id", user.id).limit(1);
  if (error) return Response.json({ error: "No se pudo actualizar la página." }, { status: 500 });
  const slug = rows?.[0]?.slug as string | undefined;
  if (!slug) return Response.json({ revalidated: false });

  // expire: 0 makes the next visit rebuild the page immediately instead of serving the stale copy.
  revalidateTag(publicPageTag(slug), { expire: 0 });
  return Response.json({ revalidated: true });
}
