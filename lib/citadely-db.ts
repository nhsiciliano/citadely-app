import type { SubscriptionPlanId } from "@/lib/subscription-plans";
import type { ServiceMode, VirtualPlatform } from "@/lib/virtual-service";

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  payment_alias: string | null;
  payment_cbu: string | null;
  payment_instructions: string | null;
  whatsapp_phone: string | null;
  public_address: string | null;
  service_mode: ServiceMode;
  virtual_platforms: VirtualPlatform[];
  logo_url: string | null;
  logo_key: string | null;
  cover_image_url: string | null;
  cover_image_key: string | null;
  brand_color: string | null;
  trial_ends_at: string;
  subscription_status: "trialing" | "active" | "past_due" | "cancelled" | "expired";
  subscription_provider: string | null;
  subscription_external_id: string | null;
  subscription_checkout_url: string | null;
  subscription_current_period_end: string | null;
  subscription_plan: SubscriptionPlanId;
  pending_subscription_plan: SubscriptionPlanId | null;
  subscription_cancel_at_period_end: boolean;
  subscription_last_payment_id: string | null;
  subscription_last_payment_status: string | null;
  subscription_last_payment_at: string | null;
  currency: string;
  timezone: string;
  is_public?: boolean;
};

export const PUBLIC_BUSINESS_COLUMNS = [
  "id",
  "name",
  "slug",
  "category",
  "description",
  "payment_alias",
  "payment_cbu",
  "payment_instructions",
  "whatsapp_phone",
  "public_address",
  "service_mode",
  "virtual_platforms",
  "logo_url",
  "cover_image_url",
  "brand_color",
  "currency",
  "timezone",
  "is_public",
].join(",");

export type PublicBusiness = Pick<
  Business,
  | "id"
  | "name"
  | "slug"
  | "category"
  | "description"
  | "payment_alias"
  | "payment_cbu"
  | "payment_instructions"
  | "whatsapp_phone"
  | "public_address"
  | "service_mode"
  | "virtual_platforms"
  | "logo_url"
  | "cover_image_url"
  | "brand_color"
  | "currency"
  | "timezone"
  | "is_public"
>;

export type Service = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  duration_minutes: number;
  price_cents: number;
  requires_payment: boolean;
  deposit_type: "free" | "deposit" | "full";
  deposit_value_cents: number;
  is_active: boolean;
};

export type Client = {
  id: string;
  business_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  notes_summary: string | null;
};

export type Appointment = {
  id: string;
  business_id: string;
  client_id: string;
  service_id: string;
  employee_id: string | null;
  starts_at: string;
  ends_at: string;
  status: "pending_payment" | "confirmed" | "cancelled" | "completed" | "no_show";
  source: "business" | "public_booking" | "client";
  client_message: string | null;
  deposit_amount_cents: number;
  deposit_expires_at: string | null;
  deposit_confirmed_at: string | null;
  deposit_confirmed_by: string | null;
  clients?: Pick<Client, "name" | "email" | "phone">;
  services?: Pick<Service, "name" | "duration_minutes" | "price_cents">;
};

export type PublicBookingSlot = {
  startsAt: string;
  endsAt: string;
  dateKey: string;
  dateLabel: string;
  weekdayLabel: string;
  timeLabel: string;
  label: string;
  available: boolean;
};

export type WorkingHour = {
  id?: string;
  business_id?: string;
  employee_id?: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type ServiceAvailabilitySlot = {
  id?: string;
  business_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type BusinessGalleryImage = {
  id: string;
  business_id: string;
  image_url: string;
  image_key: string;
  sort_order: number;
};

export type BusinessFaq = {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  sort_order: number;
};

export type BusinessStats = {
  todayAppointments: number;
  upcomingAppointments: number;
  monthlyRevenueCents: number;
  occupancy: number;
};

export function centsFromCurrency(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function formatCurrency(cents: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getBookingAmountCents(service: Service) {
  if (service.deposit_type === "free") return 0;
  if (service.deposit_type === "full") return service.price_cents;
  return service.deposit_value_cents;
}

export function getBookingPaymentLabel(service: Service, currency = "ARS") {
  const amount = getBookingAmountCents(service);

  if (service.deposit_type === "free" || amount === 0) return "Reserva gratuita";
  if (service.deposit_type === "full") return `Seña del 100% ${formatCurrency(amount, currency)}`;
  return `Seña ${formatCurrency(amount, currency)}`;
}

export function getSubscriptionState(business: Business) {
  const trialEndsAt = new Date(business.trial_ends_at);
  const now = new Date();
  const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000));
  const isTrialing = business.subscription_status === "trialing" && trialEndsAt > now;
  const periodEndsAt = business.subscription_current_period_end ? new Date(business.subscription_current_period_end) : null;
  const hasPaidPeriod = business.subscription_provider === "mercadopago"
    ? Boolean(periodEndsAt && periodEndsAt > now && ["active", "past_due", "cancelled"].includes(business.subscription_status))
    : business.subscription_status === "active";
  const hasDashboardAccess = hasPaidPeriod || isTrialing;
  const currentPlan = business.subscription_plan ?? "pro";
  const hasPublicPageAccess = (isTrialing || hasPaidPeriod) && currentPlan === "pro";

  return {
    hasAccess: hasDashboardAccess,
    hasDashboardAccess,
    hasPublicPageAccess,
    currentPlan,
    pendingPlan: business.pending_subscription_plan ?? null,
    trialDaysLeft,
    isTrialing,
    hasPaidPeriod,
    periodEndsAt,
    cancelAtPeriodEnd: Boolean(business.subscription_cancel_at_period_end),
    isPastDue: business.subscription_status === "past_due",
    awaitingFirstPayment: Boolean(
      business.subscription_external_id
      && business.pending_subscription_plan
      && !hasPaidPeriod,
    ),
    needsPayment: !hasDashboardAccess,
  };
}

function buildSlotLabels(startsAt: Date) {
  return {
    dateKey: startsAt.toISOString().slice(0, 10),
    dateLabel: new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
    }).format(startsAt),
    weekdayLabel: new Intl.DateTimeFormat("es-AR", {
      weekday: "short",
    }).format(startsAt),
    timeLabel: new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(startsAt),
    label: new Intl.DateTimeFormat("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(startsAt),
  };
}

export function buildBookingSlots(
  appointments: Appointment[],
  service?: Service | null,
  availabilitySlots: ServiceAvailabilitySlot[] = [],
): PublicBookingSlot[] {
  if (!service) return [];

  const slots: PublicBookingSlot[] = [];
  const now = new Date();
  const taken = appointments
    .filter((appointment) => appointment.status !== "cancelled")
    .map((appointment) => ({
      startsAt: new Date(appointment.starts_at).getTime(),
      endsAt: new Date(appointment.ends_at).getTime(),
    }));
  const activeSlots = availabilitySlots
    .filter((slot) => slot.is_active && slot.service_id === service.id)
    .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());

  for (const slot of activeSlots) {
    const startsAt = new Date(slot.starts_at);
    const endsAt = new Date(slot.ends_at);

    if (startsAt <= now) continue;

    const overlaps = taken.some(
      (appointment) => startsAt.getTime() < appointment.endsAt && endsAt.getTime() > appointment.startsAt,
    );

    slots.push({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      ...buildSlotLabels(startsAt),
      available: !overlaps,
    });
  }

  return slots.slice(0, 120);
}

export function calculateStats(appointments: Appointment[], services: Service[]): BusinessStats {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const todayAppointments = appointments.filter((appointment) => {
    const startsAt = new Date(appointment.starts_at);
    return startsAt >= todayStart && startsAt < todayEnd && appointment.status !== "cancelled";
  }).length;

  const upcomingAppointments = appointments.filter(
    (appointment) => new Date(appointment.starts_at) >= now && appointment.status !== "cancelled",
  ).length;

  const servicePrice = new Map(services.map((service) => [service.id, service.price_cents]));
  const monthlyRevenueCents = appointments.reduce((total, appointment) => {
    const startsAt = new Date(appointment.starts_at);
    if (startsAt < monthStart || startsAt >= monthEnd || appointment.status === "cancelled") {
      return total;
    }
    return total + (servicePrice.get(appointment.service_id) ?? appointment.services?.price_cents ?? 0);
  }, 0);

  const occupiedMinutes = appointments.reduce((total, appointment) => {
    const startsAt = new Date(appointment.starts_at);
    if (startsAt < todayStart || startsAt >= todayEnd || appointment.status === "cancelled") {
      return total;
    }
    return total + Math.max(0, new Date(appointment.ends_at).getTime() - startsAt.getTime()) / 60000;
  }, 0);

  return {
    todayAppointments,
    upcomingAppointments,
    monthlyRevenueCents,
    occupancy: Math.min(100, Math.round((occupiedMinutes / (8 * 60)) * 100)),
  };
}
