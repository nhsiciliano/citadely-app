import { Images, Trash2, Upload } from "lucide-react";
import type { BusinessGalleryImage } from "@/lib/citadely-db";

export function GallerySection({
  fileCount,
  images,
  onFileCountChange,
  onMessage,
  onRemove,
}: {
  fileCount: number;
  images: BusinessGalleryImage[];
  onFileCountChange: (count: number) => void;
  onMessage: (message: string | null) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="surface-section">
    <div className="section-heading-row"><div><h2>Galería</h2><p>Hasta 10 fotos. Aparecen como carrusel después de la portada.</p></div><Images aria-hidden="true" className="text-primary" size={21} /></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map((image, index) => (
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-subtle" key={image.id}>
          <span aria-label={`Foto ${index + 1} de la galería`} className="absolute inset-0 bg-cover bg-center" role="img" style={{ backgroundImage: `url(${image.image_url})` }} />
          <button aria-label={`Eliminar foto ${index + 1}`} className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-md bg-navy text-white shadow-md hover:bg-danger" onClick={() => onRemove(image.id)} type="button"><Trash2 aria-hidden="true" size={17} /></button>
        </div>
      ))}
    </div>
    {images.length === 0 ? <p className="border border-dashed border-line-strong bg-surface-subtle p-5 text-sm text-ink-soft">Todavía no cargaste fotos.</p> : null}
    <label className="mt-4 grid cursor-pointer gap-2 border border-dashed border-line-strong bg-surface-subtle p-4 hover:border-primary">
      <strong className="flex items-center gap-2 text-sm"><Upload aria-hidden="true" size={16} />Agregar fotos</strong>
      <small className="leading-5 text-ink-soft">JPG, PNG o WebP. Hasta 5 MB cada una. {images.length + fileCount}/10 seleccionadas.</small>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-2 file:font-semibold file:text-white"
        disabled={images.length >= 10}
        multiple
        name="gallery_files"
        onChange={(event) => {
          const count = event.target.files?.length ?? 0;
          if (images.length + count > 10) {
            event.target.value = "";
            onFileCountChange(0);
            onMessage("La galería admite hasta 10 fotos.");
            return;
          }
          onFileCountChange(count);
          onMessage(null);
        }}
        type="file"
      />
    </label>
    </section>
  );
}
