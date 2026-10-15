import { Palette } from "lucide-react";
import { TextArea } from "@/components/ui";
import type { Business } from "@/lib/citadely-db";
import { FileUpload } from "./file-upload";

export function IdentitySection({
  brandColor,
  business,
  onBrandColorChange,
  onDescriptionChange,
}: {
  brandColor: string;
  business: Business;
  onBrandColorChange: (color: string) => void;
  onDescriptionChange: (description: string) => void;
}) {
  return (
    <section className="surface-section">
    <div className="section-heading-row"><div><h2>Identidad del negocio</h2><p>Tu marca domina la experiencia de reserva.</p></div><Palette aria-hidden="true" className="text-primary" size={21} /></div>
    <div className="grid gap-5">
      <TextArea defaultValue={business.description ?? ""} label="Descripción" name="description" onChange={(value) => onDescriptionChange(value)} placeholder="Contá qué servicio ofrecés y qué necesita saber quien reserva." required={false} rows={5} />
      <label className="form-label">Color principal<span className="flex items-center gap-3"><input aria-label="Elegir color principal" className="h-12 w-16 cursor-pointer rounded-md border border-line bg-white p-1" name="brand_color" onChange={(event) => onBrandColorChange(event.target.value)} type="color" value={brandColor} /><span className="font-mono text-sm text-ink-soft">{brandColor.toUpperCase()}</span></span></label>
      <FileUpload current={business.logo_url} label="Logo" name="logo_file" note="JPG, PNG o WebP. Hasta 2 MB; recomendado 512 × 512 px." />
      <FileUpload current={business.cover_image_url} label="Portada" name="cover_file" note="JPG, PNG o WebP. Hasta 5 MB; recomendado 1600 × 600 px." />
    </div>
    </section>
  );
}
