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
