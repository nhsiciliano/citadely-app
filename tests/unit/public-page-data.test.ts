import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cached = vi.fn();
const unstableCache = vi.fn((fn: () => unknown, key: string[], options: { tags: string[]; revalidate: number }) => {
  cached(key, options);
  return fn;
});
vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));

const maybeSingle = vi.fn();
const rpc = vi.fn(() => Promise.resolve({ data: [], error: null }));
vi.mock("@/lib/insforge-public", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "order", "limit"]) chain[method] = () => chain;
  chain.maybeSingle = maybeSingle;
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
  return { insforgePublic: { database: { from: () => chain, rpc } } };
});

beforeEach(() => {
  vi.resetModules();
  cached.mockReset();
  maybeSingle.mockReset();
  rpc.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("getPublicPageData", () => {
  it("cachea por negocio con tag y 60 s por defecto", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { getPublicPageData, publicPageTag } = await import("@/lib/public-page-data");
    expect(await getPublicPageData("clinica-norte")).toBeNull();
    expect(cached).toHaveBeenCalledWith(["public-page-data", "clinica-norte"], { tags: [publicPageTag("clinica-norte")], revalidate: 60 });
    expect(publicPageTag("clinica-norte")).toBe("public-page:clinica-norte");
  });

  it("PUBLIC_PAGE_REVALIDATE_SECONDS=0 desactiva el cache", async () => {
    vi.stubEnv("PUBLIC_PAGE_REVALIDATE_SECONDS", "0");
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const { getPublicPageData } = await import("@/lib/public-page-data");
    await getPublicPageData("x");
    expect(cached).not.toHaveBeenCalled();
  });

  it("toda página publicada acepta reservas, sin consultar el acceso del negocio", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "b-1", slug: "clinica-norte", public_theme: {} }, error: null });
    const { getPublicPageData } = await import("@/lib/public-page-data");
    const data = await getPublicPageData("clinica-norte");
    expect(data?.bookable).toBe(true);
    expect(rpc).not.toHaveBeenCalledWith("business_has_booking_access", expect.anything());
  });

  it("no cachea errores: una falla de la base se propaga", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "500", message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getPublicPageData } = await import("@/lib/public-page-data");
    await expect(getPublicPageData("x")).rejects.toThrow(/boom/);
  });
});
