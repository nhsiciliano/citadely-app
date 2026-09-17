export const VIRTUAL_PLATFORM_OPTIONS = [
  { id: "zoom", label: "Zoom" },
  { id: "google_meet", label: "Google Meet" },
  { id: "microsoft_teams", label: "Microsoft Teams" },
] as const;

export type ServiceMode = "physical" | "virtual";
export type VirtualPlatform = (typeof VIRTUAL_PLATFORM_OPTIONS)[number]["id"];

export function normalizeVirtualPlatforms(value: unknown): VirtualPlatform[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<VirtualPlatform>(VIRTUAL_PLATFORM_OPTIONS.map((option) => option.id));
  return Array.from(new Set(value.filter((item): item is VirtualPlatform => typeof item === "string" && allowed.has(item as VirtualPlatform))));
}
