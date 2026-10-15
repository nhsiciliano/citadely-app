import { createRefreshAuthRouter } from "@insforge/sdk/ssr";
import { getInsforgePublicConfig } from "@/lib/insforge-config";

// El cliente de navegador renueva acá el access token con la refresh cookie httpOnly.
export const { POST } = createRefreshAuthRouter(getInsforgePublicConfig());
