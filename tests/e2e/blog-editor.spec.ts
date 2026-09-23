import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("Blog y panel editorial: borrador, portada, publicación, edición, retirada y eliminación", async ({ page, request }, testInfo) => {
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!password) throw new Error("Falta E2E_ADMIN_PASSWORD para esta prueba.");

  const title = `Novedad E2E ${randomUUID().slice(0, 8)}`;
  const publicRead = await request.get("/api/admin/blog-posts");
  expect(publicRead.status()).toBe(401);

  await page.goto("/admin-panel");
  await expect(page.getByRole("heading", { name: "Panel editorial" })).toBeVisible();
  await page.getByLabel("Usuario").fill("admin");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("incorrectos");

  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Publicaciones", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nueva publicación" }).click();
  await page.getByLabel("Título de la nueva publicación").fill(title);
  await page.getByRole("button", { name: "Crear borrador" }).click();
  await expect(page).toHaveURL(/\/admin-panel\/posts\/[0-9a-f-]+$/);
  const originalSlug = (await page.locator("main").textContent())?.match(/URL permanente: \/blog\/([a-z0-9-]+)/)?.[1];
  expect(originalSlug).toBe(title.toLowerCase().replaceAll(" ", "-"));
  const duplicate = await page.context().request.post("/admin-panel/api/blog-posts", {
    headers: { Origin: "http://127.0.0.1:3002" }, data: { title },
  });
  expect(duplicate.status()).toBe(201);
  const duplicatePost = (await duplicate.json()).post as { id: string; slug: string };
  expect(duplicatePost.slug).toBe(`${originalSlug}-2`);
  expect((await page.context().request.delete(`/admin-panel/api/blog-posts/${duplicatePost.id}`, {
    headers: { Origin: "http://127.0.0.1:3002" },
  })).ok()).toBeTruthy();

  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("completá título, portada");
  await page.getByLabel("Descripción de la imagen").fill("Gráfico de ejemplo sobre una nueva función de Citadely");
  await page.getByLabel("Portada").setInputFiles({
    name: "portada.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.getByText("Portada cargada.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Agregar bloque" }).click();
  await page.getByLabel("Tipo de bloque 1").selectOption("paragraph");
  await page.getByLabel("Texto").fill("Una mejora creada para simplificar la jornada.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  await page.screenshot({ path: testInfo.outputPath("editor-desktop.png"), fullPage: true });

  const preview = await page.context().newPage();
  await preview.goto(`${page.url()}/preview`);
  await expect(preview.getByText("Vista previa privada")).toBeVisible();
  await expect(preview.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(preview.getByRole("heading", { name: title })).toBeVisible();
  await preview.close();

  await page.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("visible en el Blog");
  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("link", { name: "Blog", exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("blog-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Menú móvil" })).toBeHidden();
  await page.locator("summary", { hasText: "Menú" }).click();
  await expect(page.getByRole("navigation", { name: "Menú móvil" }).getByRole("link", { name: "Blog" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("blog-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/blog/${originalSlug}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Una mejora creada para simplificar la jornada.")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://citadely.com.ar/blog/${originalSlug}`);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain(`/blog/${originalSlug}`);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Disallow: /admin-panel");

  await page.goto("/admin-panel");
  await page.getByRole("link", { name: /Editar/ }).first().click();
  const editedTitle = `${title} actualizada`;
  await page.getByLabel("Título", { exact: true }).fill(editedTitle);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("visible en el Blog");
  await expect(page.getByText(`URL permanente: /blog/${originalSlug}`)).toBeVisible();
  await page.getByRole("button", { name: "Retirar publicación" }).click();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  const hidden = await request.get(`/blog/${originalSlug}`);
  expect(hidden.status()).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(`/blog/${originalSlug}`);

  await page.goto("/admin-panel");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Eliminar ${editedTitle}` }).click();
  await expect(page.getByRole("heading", { name: editedTitle })).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Panel editorial" })).toBeVisible();
});

test("sesiones manipuladas o vencidas no acceden al panel", async ({ request }) => {
  const password = process.env.E2E_ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !secret) throw new Error("Faltan credenciales de prueba.");
  const login = await request.post("/admin-panel/api/session", {
    headers: { Origin: "http://127.0.0.1:3002", "x-real-ip": `e2e-${randomUUID()}` },
    data: { username: "admin", password },
  });
  expect(login.status()).toBe(200);
  const cookie = login.headers()["set-cookie"]?.match(/citadely_blog_admin=([^;]+)/)?.[1];
  expect(cookie).toBeTruthy();
  const tampered = `${cookie!.slice(0, -1)}${cookie!.at(-1) === "a" ? "b" : "a"}`;
  expect((await request.get("/admin-panel/api/blog-posts", { headers: { Cookie: `citadely_blog_admin=${tampered}` } })).status()).toBe(401);

  const payload = Buffer.from(JSON.stringify({ u: "admin", exp: Date.now() - 1000, n: randomUUID().replaceAll("-", "") })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  expect((await request.get("/admin-panel/api/blog-posts", { headers: { Cookie: `citadely_blog_admin=${payload}.${signature}` } })).status()).toBe(401);
});

test("cinco fallos bloquean el acceso sin filtrar credenciales", async ({ request }) => {
  const ip = `e2e-${randomUUID()}`;
  const headers = { Origin: "http://127.0.0.1:3002", "x-real-ip": ip };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request.post("/admin-panel/api/session", { headers, data: { username: "admin", password: "incorrecta" } });
    expect(response.status()).toBe(401);
  }
  const blocked = await request.post("/admin-panel/api/session", { headers, data: { username: "admin", password: "incorrecta" } });
  expect(blocked.status()).toBe(429);
});
