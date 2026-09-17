import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BusinessShell } from "@/components/business/business-shell";
import { WorkspaceProvider } from "@/components/business/workspace-context";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: NO_INDEX_ROBOTS,
};

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <BusinessShell>{children}</BusinessShell>
    </WorkspaceProvider>
  );
}
