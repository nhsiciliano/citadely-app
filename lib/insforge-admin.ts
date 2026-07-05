import "server-only";
import { createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;

const apiKey = process.env.INSFORGE_API_KEY;

export const hasInsforgeAdminKey = Boolean(baseUrl && apiKey);

export const insforgeAdmin = baseUrl && apiKey
  ? createClient({
      baseUrl,
      anonKey: apiKey,
      isServerMode: true,
    })
  : null;
