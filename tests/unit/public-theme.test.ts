import { describe, expect, it } from "vitest";
import { contrastRatio, normalizePublicTheme, resolveSectionColors, sectionThemeStyle } from "@/lib/public-theme";

describe("lib/public-theme", () => {
  it("normaliza solo colores válidos y secciones conocidas", () => {
    expect(normalizePublicTheme({ faq: { background: "red", accent: "#FFFFFF" }, unknown: { accent: "#000000" } })).toEqual({ faq: { accent: "#ffffff" } });
    expect(sectionThemeStyle("faq", {}, "#0957d9")).toBeUndefined();
  });

  it("los colores personalizados mantienen contraste AA", () => {
    for (const background of ["#ffffff", "#111827", "#ffff00", "#777777", "#0957d9"]) {
      for (const accent of ["#ffffff", "#111827", "#ffff00", "#777777", "#0957d9"]) {
        const colors = resolveSectionColors("faq", { faq: { background, accent } }, "#0957d9");
        expect(contrastRatio(colors.ink, colors.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.muted, colors.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.accent, colors.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.accentInk, colors.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.cardAccent, "#ffffff")).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(colors.cardAccentInk, colors.cardAccent)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
