"use client";

import { insforge } from "@/lib/insforge";

export async function saveBusinessNotificationEmail(businessId: string, email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) return null;

  return insforge.database
    .from("business_notification_settings")
    .upsert([{ business_id: businessId, email: normalizedEmail }], { onConflict: "business_id" });
}
