import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cached = vi.fn();
const unstableCache = vi.fn((fn: () => unknown, key: string[], options: { tags: string[]; revalidate: number }) => {
  cached(key, options);
  return fn;
});
vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));

const maybeSingle = vi.fn();
vi.mock("@/lib/insforge", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "order", "limit"]) chain[method] = () => chain;
  chain.maybeSingle = maybeSingle;
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
  return { insforge: { database: { from: () => chain, rpc: () => Promise.resolve({ data: true, error: null }) } } };
});

beforeEach(() => {
  vi.resetModules();
  cached.mockReset();
  maybeSingle.mockReset();
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

  it("no cachea errores: una falla de la base se propaga", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "500", message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getPublicPageData } = await import("@/lib/public-page-data");
    await expect(getPublicPageData("x")).rejects.toThrow(/boom/);
  });
});
