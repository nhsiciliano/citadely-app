import type { ReactNode } from "react";
import { BusinessShell } from "@/components/business/business-shell";
import { WorkspaceProvider } from "@/components/business/workspace-context";

export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <BusinessShell>{children}</BusinessShell>
    </WorkspaceProvider>
  );
}
