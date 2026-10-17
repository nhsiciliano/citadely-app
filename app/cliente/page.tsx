import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Citadely",
  robots: NO_INDEX_ROBOTS,
};

// Ruta reservada al área de cliente, que hoy no existe. Solo redirige. Se borra o construye según la
// decisión pendiente sobre el rol "client" (plan, 5.5).
export default function ClientPage() {
  redirect("/");
}
