import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp, hasEnoughPhoneDigits, hashIp, isEmail, isUuid, verifyTurnstileToken } from "@/lib/booking-protection";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("lib/booking-protection", () => {
  it("valida ids, emails y teléfonos", () => {
    expect(isUuid("8e208072-3fbe-431f-be0b-5a2b5ceae506")).toBe(true);
    expect(isUuid("no-es-uuid")).toBe(false);
    expect(isEmail("ana@example.com")).toBe(true);
    expect(isEmail("ana@example")).toBe(false);
    expect(isEmail("ana @example.com")).toBe(false);
    expect(hasEnoughPhoneDigits("11 2345-6789")).toBe(true);
    expect(hasEnoughPhoneDigits("12345")).toBe(false);
  });

  it("toma la IP del primer valor de x-forwarded-for y prefiere la cabecera de Vercel", () => {
    const withHeaders = (headers: Record<string, string>) => getClientIp(new Request("https://x.test", { headers }));
    expect(withHeaders({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })).toBe("1.1.1.1");
    expect(withHeaders({ "x-vercel-forwarded-for": "3.3.3.3", "x-forwarded-for": "1.1.1.1" })).toBe("3.3.3.3");
    expect(withHeaders({ "x-real-ip": "4.4.4.4" })).toBe("4.4.4.4");
    expect(withHeaders({})).toBeUndefined();
  });

  it("hashea la IP con HMAC estable y sin exponerla", () => {
    vi.stubEnv("PUBLIC_BOOKING_HASH_SECRET", "k1");
    const first = hashIp("1.1.1.1");
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("1.1.1.1");
    expect(hashIp("1.1.1.1")).toBe(first);
    expect(hashIp("1.1.1.2")).not.toBe(first);
    vi.stubEnv("PUBLIC_BOOKING_HASH_SECRET", "k2");
    expect(hashIp("1.1.1.1")).not.toBe(first);
    expect(hashIp(undefined)).toBeNull();
  });

  it("Turnstile solo se exige con TURNSTILE_SECRET_KEY", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(await verifyTurnstileToken("", undefined)).toBe(true);

    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await verifyTurnstileToken("", undefined)).toBe(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstileToken("token", "1.1.1.1")).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false })));
    expect(await verifyTurnstileToken("bad", undefined)).toBe(false);
    fetchMock.mockRejectedValueOnce(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await verifyTurnstileToken("token", undefined)).toBe(false);
  });
});
