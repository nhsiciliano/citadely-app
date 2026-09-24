import { redirect } from "next/navigation";
import { PromoCodesAdmin } from "@/components/admin/promo-codes-admin";
import { hasAdminSession } from "@/lib/blog-admin-auth";

export default async function PromoCodesPage() {
  if (!(await hasAdminSession())) redirect("/admin-panel");
  return <PromoCodesAdmin />;
}
