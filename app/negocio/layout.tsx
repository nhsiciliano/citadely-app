import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BusinessShell } from "@/components/business/business-shell";
import { WorkspaceProvider } from "@/components/business/workspace-context";
import { getErrorMessage, getPostAuthPath } from "@/lib/auth";
import type { Business } from "@/lib/citadely-db";
import { createInsforgeServerClient } from "@/lib/insforge-server";
import { NO_INDEX_ROBOTS } from "@/lib/seo";
import { getHistoryStart, loadWorkspaceData } from "@/lib/workspace-data";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: NO_INDEX_ROBOTS,
};

// Control de acceso real del panel (proxy.ts solo hace el redirect optimista): sin sesión, sin onboarding
// o sin negocio no se renderiza nada del dashboard. El primer dataset viaja como props al provider.
export default async function BusinessLayout({ children }: { children: ReactNode }) {
  const client = await createInsforgeServerClient();
  const { data: auth } = await client.auth.getCurrentUser();
  const user = auth.user;
  if (!user) redirect("/login?next=/negocio");

  const postAuthPath = getPostAuthPath(user);
  if (postAuthPath !== "/negocio") redirect(postAuthPath);

  const { data: businessRow, error: businessError } = await client.database
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError) throw new Error(getErrorMessage(businessError));
  // Sin negocio no hay panel: el onboarding es quien lo crea.
  if (!businessRow) redirect("/onboarding");

  const business = businessRow as Business;
  const historyStart = getHistoryStart();
  const data = await loadWorkspaceData(client, business.id, historyStart);

  return (
    <WorkspaceProvider initial={{ ...data, business, userEmail: user.email ?? "", historyStart }}>
      <BusinessShell>{children}</BusinessShell>
    </WorkspaceProvider>
  );
}
