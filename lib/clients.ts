import type { Client } from "@/lib/citadely-db";
import { insforge } from "@/lib/insforge";

export type NewClientInput = {
  businessId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

// Única normalización de datos de cliente: el nombre sin espacios sobrantes, el email en minúsculas
// y los campos vacíos como null.
export function normalizeClientInput(input: Omit<NewClientInput, "businessId">) {
  return {
    name: input.name.trim(),
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
  };
}

export async function createClient(input: NewClientInput) {
  const normalized = normalizeClientInput(input);
  if (!normalized.name) {
    return { data: null, error: new Error("Ingresá el nombre y apellido del cliente.") };
  }

  return insforge.database
    .from("clients")
    .insert([{ business_id: input.businessId, ...normalized }])
    .select("id,business_id,user_id,name,email,phone,notes_summary")
    .single();
}

export const CLIENT_COLUMNS = "id,business_id,user_id,name,email,phone,notes_summary";
export const CLIENT_PAGE_SIZE = 25;

// PostgREST reserves these characters inside or() filters; they never matter for a name/email/phone search.
function sanitizeSearchTerm(term: string) {
  return term.replace(/[,()*%\\"]/g, " ").replace(/\s+/g, " ").trim();
}

/** Server-side paginated client search (name, email or phone), newest first. */
export async function searchClients({
  businessId,
  query = "",
  offset = 0,
  limit = CLIENT_PAGE_SIZE,
}: {
  businessId: string;
  query?: string;
  offset?: number;
  limit?: number;
}) {
  let request = insforge.database
    .from("clients")
    .select(CLIENT_COLUMNS, { count: "exact" })
    .eq("business_id", businessId);

  const term = sanitizeSearchTerm(query);
  if (term) request = request.or(`name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*`);

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  return { data: (data ?? []) as Client[], total: count ?? null, error };
}
