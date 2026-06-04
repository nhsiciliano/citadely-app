import { createClient } from "@insforge/sdk";

const baseUrl =
  process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ??
  "https://3v48rhzn.us-east.insforge.app";

const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

export const insforge = createClient({
  baseUrl,
  ...(anonKey ? { anonKey } : {}),
});
