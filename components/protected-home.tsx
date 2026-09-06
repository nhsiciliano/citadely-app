// Compatibilidad temporal para imports históricos. El workspace real vive en
// el layout anidado de /negocio y conserva datos y estado entre rutas.
export { WorkspaceProvider } from "@/components/business/workspace-context";
export { BusinessShell } from "@/components/business/business-shell";
export { OverviewScreen as BusinessHome } from "@/components/business/screens/overview-screen";
