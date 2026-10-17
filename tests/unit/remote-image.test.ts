import { describe, expect, it } from "vitest";
import { isOptimizableImageUrl } from "@/components/remote-image";

describe("isOptimizableImageUrl", () => {
  it("optimiza solo el storage de InsForge (parent y branches)", () => {
    expect(isOptimizableImageUrl("https://3v48rhzn.us-east.insforge.app/api/storage/buckets/business-assets/objects/x.jpg?v=1")).toBe(true);
    expect(isOptimizableImageUrl("https://3v48rhzn-36a.us-east.insforge.app/api/storage/buckets/b/objects/y.png")).toBe(true);
  });

  it("deja sin optimizar cualquier otro host, protocolo o ruta (el optimizador los rechazaría)", () => {
    expect(isOptimizableImageUrl("https://images.unsplash.com/photo-1?w=1800")).toBe(false);
    expect(isOptimizableImageUrl("https://encrypted-tbn0.gstatic.com/images?q=tbn:x")).toBe(false);
    expect(isOptimizableImageUrl("http://3v48rhzn.us-east.insforge.app/api/storage/x.jpg")).toBe(false);
    expect(isOptimizableImageUrl("https://3v48rhzn.us-east.insforge.app/api/database/x")).toBe(false);
    expect(isOptimizableImageUrl("https://evil.com/.us-east.insforge.app/api/storage/x")).toBe(false);
    expect(isOptimizableImageUrl("no es una url")).toBe(false);
  });
});
