import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: (fn: unknown) => fn }));

const getCurrentUser = vi.fn();
vi.mock("@insforge/sdk", () => ({
  createClient: () => ({ setAccessToken: vi.fn(), auth: { getCurrentUser } }),
}));

const limit = vi.fn();
vi.mock("@/lib/insforge-admin", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.limit = limit;
  return { insforgeAdmin: { database: { from: () => chain } } };
});

const post = async (authorization?: string) => {
  const { POST } = await import("@/app/api/revalidate-public-page/route");
  const response = await POST(new Request("https://x.test/api/revalidate-public-page", { method: "POST", headers: authorization ? { authorization } : {} }) as never);
  return { status: response.status, json: await response.json() };
};

beforeEach(() => {
  revalidateTag.mockReset();
  getCurrentUser.mockReset();
  limit.mockReset();
});

describe("POST /api/revalidate-public-page", () => {
  it("exige sesión válida", async () => {
    expect((await post()).status).toBe(401);
    getCurrentUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad token" } });
    expect((await post("Bearer malo")).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("revalida solo la página del negocio del usuario autenticado", async () => {
    getCurrentUser.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    limit.mockResolvedValueOnce({ data: [{ slug: "clinica-norte" }], error: null });
    const result = await post("Bearer bueno");
    expect(result).toEqual({ status: 200, json: { revalidated: true } });
    expect(revalidateTag).toHaveBeenCalledOnce();
    expect(revalidateTag).toHaveBeenCalledWith("public-page:clinica-norte", { expire: 0 });
  });

  it("no hace nada si el usuario no tiene negocio", async () => {
    getCurrentUser.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    limit.mockResolvedValueOnce({ data: [], error: null });
    expect((await post("Bearer bueno")).json).toEqual({ revalidated: false });
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
