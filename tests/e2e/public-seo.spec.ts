import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("SEO público, indexación y errores reales", async ({ page, request }) => {
  const permissionCheck = execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    `import { createClient } from "@insforge/sdk";
     const client = createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
     const safe = await client.database.from("businesses").select("id,name,slug").eq("is_public", true).limit(1);
     const protectedRead = await client.database.from("businesses").select("id,subscription_external_id").limit(1);
     if (safe.error || !safe.data?.length || !protectedRead.error) process.exit(1);
     process.stdout.write("ok");`,
  ], { cwd: process.cwd(), encoding: "utf8" });
  expect(permissionCheck).toBe("ok");

  await page.goto("/");
  await expect(page).toHaveTitle("Citadely | Agenda y turnos online para negocios");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.citadely.com.ar");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /citadely\.com\.ar\/opengraph-image/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Gratis para tu negocio/);

  // / lo sirve Astro vía el rewrite de Next: sus assets salen de /landing-assets/* y el JSON-LD publica el producto gratis.
  const landingStylesheets = page.locator('link[rel="stylesheet"][href^="/landing-assets/"]');
  expect(await landingStylesheets.count()).toBeGreaterThan(0);
  const stylesheetResponse = await request.get((await landingStylesheets.first().getAttribute("href"))!);
  expect(stylesheetResponse.status()).toBe(200);
  expect(stylesheetResponse.headers()["content-type"]).toContain("text/css");
  const landingJsonLd = (await page.locator('script[type="application/ld+json"]').textContent()) ?? "";
  expect(landingJsonLd).toContain('"price":"0"');
  expect(landingJsonLd).not.toMatch(/14[.]?000|18[.]?000/);

  await page.goto("/politica-de-privacidad");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.citadely.com.ar/politica-de-privacidad");
  await expect(page.getByRole("heading", { level: 1, name: "Política de privacidad" })).toBeVisible();

  await page.goto("/b/citadely-demo-ux");
  await expect(page).toHaveTitle("Consultorios Horizonte | Turnos online | Citadely");
  // Fuera de producción no hay subdominios: la canonical apunta a /b/<slug> del origen del deployment.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/b\/citadely-demo-ux$/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);

  const missingResponse = await page.goto("/b/seo-url-inexistente");
  expect(missingResponse?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Sitemap: https://www.citadely.com.ar/sitemap.xml");
  const sitemap = await request.get("/sitemap.xml");
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("https://www.citadely.com.ar");
  expect(sitemapBody).toContain("/b/citadely-demo-ux");
});
