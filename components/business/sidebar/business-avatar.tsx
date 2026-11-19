"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { RemoteImage } from "@/components/remote-image";
import { getBusinessInitials } from "@/lib/business-initials";

type BusinessAvatarProps = {
  name: string;
  logoUrl: string | null;
  className?: string;
};

// Identidad compacta del negocio: su logo si lo cargó; si no, un monograma de dos letras. El nombre
// siempre acompaña en el DOM (aunque esté oculto visualmente al colapsar), por eso el avatar es decorativo.
export function BusinessAvatar({ name, logoUrl, className = "h-10 w-10 text-sm" }: BusinessAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showLogo = Boolean(logoUrl) && failedSrc !== logoUrl;

  if (showLogo && logoUrl) {
    return (
      <span aria-hidden="true" className={`relative block shrink-0 overflow-hidden rounded-md bg-white ${className}`}>
        <RemoteImage alt="" className="object-contain p-1" fill onError={() => setFailedSrc(logoUrl)} sizes="40px" src={logoUrl} />
      </span>
    );
  }

  const initials = getBusinessInitials(name);
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-md font-semibold tracking-[-0.02em] bg-navy-raised text-white ring-1 ring-white/15 ring-inset ${className}`}>
      {initials || <Store size={18} strokeWidth={1.8} />}
    </span>
  );
}
