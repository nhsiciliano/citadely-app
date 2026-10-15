import { insforge } from "@/lib/insforge";

/**
 * Tells the server to rebuild the cached public page of the signed-in owner's business.
 * Best effort and never throws: if it fails, the page refreshes on its own within a minute.
 */
export async function revalidatePublicPage() {
  try {
    const { data: session } = await insforge.auth.refreshSession();
    if (!session?.accessToken) return;
    await fetch("/api/revalidate-public-page", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}` },
      keepalive: true,
    });
  } catch {
    // Intentionally ignored (see above).
  }
}
