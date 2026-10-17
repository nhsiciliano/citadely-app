import { createClient } from "@insforge/sdk";
import { getInsforgePublicConfig } from "@/lib/insforge-config";

// Cliente anónimo para lecturas públicas desde el servidor (página pública, sitemap, blog). Sin sesión.
export const insforgePublic = createClient({ ...getInsforgePublicConfig(), isServerMode: true });
