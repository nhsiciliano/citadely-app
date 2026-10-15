import { getErrorMessage } from "@/lib/auth";

// clients_business_email_unique_idx rejects a second client with the same email in a business.
export function getClientSaveErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  if (/clients_business_email_unique_idx|duplicate key|unique constraint/i.test(message)) {
    return "Ya existe un cliente con ese email en tu negocio. Buscalo en la lista.";
  }
  return message;
}
