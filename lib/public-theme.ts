import type { CSSProperties } from "react";

export const PUBLIC_THEME_SECTIONS = ["header", "hero", "services", "booking", "gallery", "info", "faq"] as const;
export type PublicThemeSection = (typeof PUBLIC_THEME_SECTIONS)[number];
export type SectionColors = { background?: string; accent?: string };
export type PublicTheme = Partial<Record<PublicThemeSection, SectionColors>>;

export const PUBLIC_THEME_LABELS: Record<PublicThemeSection, string> = {
  header: "Encabezado",
  hero: "Portada",
  services: "Servicios",
  booking: "Reserva",
  gallery: "Galería",
  info: "Información del servicio",
  faq: "Preguntas frecuentes",
};

const DEFAULT_BACKGROUNDS: Record<PublicThemeSection, string> = {
  header: "#071f3d",
  hero: "#ffffff",
  services: "#ffffff",
  booking: "#ffffff",
  gallery: "#ffffff",
  info: "#ffffff",
  faq: "#f7f9fc",
};

export const DEFAULT_BRAND_COLOR = "#0957d9";
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function normalizePublicTheme(value: unknown): PublicTheme {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const result: PublicTheme = {};
  for (const section of PUBLIC_THEME_SECTIONS) {
    const colors = input[section];
    if (!colors || typeof colors !== "object" || Array.isArray(colors)) continue;
    const entry = colors as Record<string, unknown>;
    const background = isHexColor(entry.background) ? entry.background.toLowerCase() : undefined;
    const accent = isHexColor(entry.accent) ? entry.accent.toLowerCase() : undefined;
    if (background || accent) result[section] = { ...(background ? { background } : {}), ...(accent ? { accent } : {}) };
  }
  return result;
}

export function defaultSectionColors(section: PublicThemeSection, brandColor: string): { background: string; accent: string } {
  return {
    background: DEFAULT_BACKGROUNDS[section],
    accent: section === "faq" ? "#071f3d" : isHexColor(brandColor) ? brandColor.toLowerCase() : DEFAULT_BRAND_COLOR,
  };
}

function channels(hex: string) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
}

function luminance(hex: string) {
  const [red, green, blue] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(a: string, b: string) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function mix(from: string, to: string, amount: number) {
  const start = channels(from);
  const end = channels(to);
  return `#${start.map((channel, index) => Math.round(channel + (end[index] - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function readableText(background: string) {
  if (contrastRatio(background, "#091a33") >= 4.5) return "#091a33";
  if (contrastRatio(background, "#ffffff") >= 4.5) return "#ffffff";
  return "#000000";
}

function ensureContrast(color: string, background: string, minimum: number) {
  if (contrastRatio(color, background) >= minimum) return color;
  const toward = readableText(background);
  let low = 0;
  let high = 1;
  for (let index = 0; index < 12; index += 1) {
    const middle = (low + high) / 2;
    if (contrastRatio(mix(color, toward, middle), background) >= minimum) high = middle;
    else low = middle;
  }
  return mix(color, toward, high);
}

export function resolveSectionColors(section: PublicThemeSection, theme: PublicTheme, brandColor: string) {
  const defaults = defaultSectionColors(section, brandColor);
  const selected = theme[section];
  const background = selected?.background ?? defaults.background;
  const requestedAccent = selected?.accent ?? defaults.accent;
  const customized = Boolean(selected?.background || selected?.accent);
  const accent = customized ? ensureContrast(requestedAccent, background, 4.5) : requestedAccent;
  const ink = readableText(background);
  const muted = ensureContrast(mix(ink, background, 0.3), background, 4.5);
  const cardAccent = customized ? ensureContrast(accent, "#ffffff", 4.5) : accent;
  return { background, requestedAccent, accent, cardAccent, ink, muted, accentInk: readableText(accent), cardAccentInk: readableText(cardAccent), customized };
}

export function sectionThemeStyle(section: PublicThemeSection, theme: PublicTheme, brandColor: string): CSSProperties | undefined {
  const colors = resolveSectionColors(section, theme, brandColor);
  if (!colors.customized) return undefined;
  return {
    "--public-section-bg": colors.background,
    "--public-section-ink": colors.ink,
    "--public-section-muted": colors.muted,
    "--public-section-accent": colors.accent,
    "--public-section-accent-ink": colors.accentInk,
    "--public-card-accent": colors.cardAccent,
    "--public-card-accent-ink": colors.cardAccentInk,
    "--booking-brand": colors.accent,
    "--booking-brand-foreground": colors.accentInk,
    "--color-ink": colors.ink,
    "--color-ink-soft": colors.muted,
    "--color-ink-muted": colors.muted,
    "--color-line": mix(colors.ink, colors.background, 0.76),
    "--color-line-strong": mix(colors.ink, colors.background, 0.62),
  } as CSSProperties;
}
