import { insforge } from "@/lib/insforge";

// Uploads of business images (logo, cover, gallery) to InsForge storage, with the size and type limits
// the dashboard promises ("JPG, PNG o WebP. Hasta 2 MB / 5 MB").

export const BUSINESS_ASSETS_BUCKET = "business-assets";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function getFormFile(form: FormData, name: string) {
  const file = form.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "image";
}

export async function uploadImage(businessId: string, folder: "logo" | "cover" | "gallery", file: File) {
  const maxBytes = folder === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Subí una imagen JPG, PNG o WebP.");
  if (file.size > maxBytes) throw new Error(`La imagen no puede superar ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const key = `${businessId}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
  const bucket = insforge.storage.from(BUSINESS_ASSETS_BUCKET);
  const uploaded = await bucket.upload(key, file);
  if (uploaded.error || !uploaded.data) throw new Error(uploaded.error?.message ?? "No se pudo subir la imagen.");
  return uploaded.data;
}


/** Best-effort removal of stored images (used to clean up replaced or abandoned uploads). */
export async function removeStoredImages(keys: string[]) {
  await Promise.all(keys.map((key) => insforge.storage.from(BUSINESS_ASSETS_BUCKET).remove(key)));
}
