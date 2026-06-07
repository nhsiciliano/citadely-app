import "server-only";
import { createClient } from "@insforge/sdk";

const baseUrl =
  process.env.INSFORGE_BASE_URL ??
  process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ??
  "https://3v48rhzn.us-east.insforge.app";

const apiKey = process.env.INSFORGE_API_KEY;

export const hasInsforgeAdminKey = Boolean(apiKey);

export const insforgeAdmin = apiKey
  ? createClient({
      baseUrl,
      anonKey: apiKey,
      isServerMode: true,
    })
  : null;
