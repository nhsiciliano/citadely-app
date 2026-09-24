import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = { title: "Panel administrativo", robots: NO_INDEX_ROBOTS };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[var(--color-canvas)]">{children}</div>;
}
