import { SettingsScreen } from "@/components/business/screens/settings-screen";
import { parseContributionReturnResult } from "@/lib/contributions";

type SettingsPageProps = { searchParams: Promise<{ aporte?: string | string[] }> };

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  // Mercado Pago vuelve con ?aporte=aprobado|pendiente|fallido (back_urls de /api/contributions/checkout).
  const contributionResult = parseContributionReturnResult((await searchParams).aporte);
  return <SettingsScreen contributionResult={contributionResult} />;
}
