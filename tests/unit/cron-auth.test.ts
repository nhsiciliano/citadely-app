import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

afterEach(() => vi.unstubAllEnvs());

const req = (authorization?: string) => new Request("https://x.test/api/cron/x", { headers: authorization ? { authorization } : {} });

describe("isAuthorizedCronRequest", () => {
  it("rechaza todo si CRON_SECRET no está definido", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(isAuthorizedCronRequest(req("Bearer "))).toBe(false);
    expect(isAuthorizedCronRequest(req())).toBe(false);
  });

  it("acepta solo el Bearer exacto", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isAuthorizedCronRequest(req("Bearer s3cret"))).toBe(true);
    expect(isAuthorizedCronRequest(req("Bearer s3cre"))).toBe(false);
    expect(isAuthorizedCronRequest(req("Bearer s3cretx"))).toBe(false);
    expect(isAuthorizedCronRequest(req("s3cret"))).toBe(false);
    expect(isAuthorizedCronRequest(req())).toBe(false);
  });
});
