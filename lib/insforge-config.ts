// URL y anon key públicas del backend, compartidas por los clientes de navegador, servidor y proxy.
export function getInsforgePublicConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error("Faltan NEXT_PUBLIC_INSFORGE_BASE_URL o NEXT_PUBLIC_INSFORGE_ANON_KEY.");
  return { baseUrl, anonKey };
}
