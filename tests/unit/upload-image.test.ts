import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
vi.mock("@/lib/insforge", () => ({ insforge: { storage: { from: () => ({ upload, remove: vi.fn() }) } } }));

import { getFormFile, uploadImage } from "@/lib/upload-image";

const file = (name: string, type: string, bytes: number) => new File([new Uint8Array(bytes)], name, { type });

beforeEach(() => upload.mockReset());

describe("uploadImage", () => {
  it("rechaza tipos que no son JPG, PNG o WebP", async () => {
    await expect(uploadImage("b1", "logo", file("a.gif", "image/gif", 10))).rejects.toThrow(/JPG, PNG o WebP/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("limita el logo a 2 MB y portada/galería a 5 MB", async () => {
    await expect(uploadImage("b1", "logo", file("a.png", "image/png", 2 * 1024 * 1024 + 1))).rejects.toThrow(/2 MB/);
    await expect(uploadImage("b1", "cover", file("a.png", "image/png", 5 * 1024 * 1024 + 1))).rejects.toThrow(/5 MB/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("sube con una clave por negocio y carpeta, y devuelve url y key", async () => {
    upload.mockResolvedValueOnce({ data: { url: "https://x/y", key: "k" }, error: null });
    const result = await uploadImage("b1", "gallery", file("Mi Foto Ñ.JPG", "image/jpeg", 100));
    expect(result).toEqual({ url: "https://x/y", key: "k" });
    expect(upload.mock.calls[0][0]).toMatch(/^b1\/gallery\/\d+-[0-9a-f-]{36}-mi-foto-\.jpg$/);
  });

  it("propaga el error del storage", async () => {
    upload.mockResolvedValueOnce({ data: null, error: { message: "bucket lleno" } });
    await expect(uploadImage("b1", "cover", file("a.webp", "image/webp", 10))).rejects.toThrow(/bucket lleno/);
  });
});

describe("getFormFile", () => {
  it("devuelve null para campos vacíos o que no son archivos", () => {
    const form = new FormData();
    form.set("a", "texto");
    form.set("b", new File([], "vacio.png"));
    expect(getFormFile(form, "a")).toBeNull();
    expect(getFormFile(form, "b")).toBeNull();
    expect(getFormFile(form, "zzz")).toBeNull();
  });
});
