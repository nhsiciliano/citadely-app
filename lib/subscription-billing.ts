export type BillingWindow = {
  trial_ends_at: string;
  promotion_ends_at: string | null;
  subscription_status: string;
  subscription_cancel_at_period_end: boolean;
  subscription_current_period_end: string | null;
};

export function getBillingStartAt(business: BillingWindow, now = Date.now()) {
  const trialEnd = new Date(business.trial_ends_at).getTime();
  const promotionEnd = business.promotion_ends_at ? new Date(business.promotion_ends_at).getTime() : 0;
  const periodEnd = business.subscription_current_period_end
    ? new Date(business.subscription_current_period_end).getTime()
    : 0;

  const firstChargeAt = Math.max(
    promotionEnd,
    business.subscription_status === "trialing" ? trialEnd : 0,
    business.subscription_cancel_at_period_end ? periodEnd : 0,
  );
  return firstChargeAt > now ? new Date(firstChargeAt).toISOString() : null;
}
