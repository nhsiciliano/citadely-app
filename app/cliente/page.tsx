import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Citadely",
  robots: NO_INDEX_ROBOTS,
};

export default function ClientPage() {
  redirect("/");
}
