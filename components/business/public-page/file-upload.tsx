import { ImagePlus, Upload } from "lucide-react";

export function FileUpload({ label, name, current, note }: { label: string; name: string; current?: string | null; note: string }) {
  return (
    <label className="grid cursor-pointer gap-4 border border-dashed border-line-strong bg-surface-subtle p-4 hover:border-primary sm:grid-cols-[110px_1fr] sm:items-center">
      <span className="grid h-24 place-items-center overflow-hidden rounded-md bg-white" style={current ? { backgroundImage: `url(${current})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>
        {!current ? <ImagePlus aria-hidden="true" className="text-primary" size={24} /> : null}
      </span>
      <span><strong className="flex items-center gap-2 text-sm"><Upload aria-hidden="true" size={16} />{label}</strong><small className="mt-2 block leading-5 text-ink-soft">{note}</small><input accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-2 file:font-semibold file:text-white" name={name} type="file" /></span>
    </label>
  );
}
