import { createClient } from "@insforge/sdk";

export const insforgeServer = createClient({
  baseUrl:
    process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ??
    process.env.INSFORGE_BASE_URL ??
    "https://3v48rhzn.us-east.insforge.app",
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_ANON_KEY,
  isServerMode: true,
});
