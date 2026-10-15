import type { Metadata } from "next";
import { OAuthCallback } from "@/components/auth/oauth-callback";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Ingresando",
  robots: NO_INDEX_ROBOTS,
};

export default function AuthCallbackPage() {
  return <OAuthCallback />;
}
