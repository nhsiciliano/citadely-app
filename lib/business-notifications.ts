"use client";

import { insforge } from "@/lib/insforge";

export async function saveBusinessNotificationEmail(businessId: string, email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) return null;

  await insforge.database
    .from("business_notification_settings")
    .delete()
    .eq("business_id", businessId);

  return insforge.database
    .from("business_notification_settings")
    .insert([{ business_id: businessId, email: normalizedEmail }]);
}
