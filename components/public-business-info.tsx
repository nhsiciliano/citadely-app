import { CalendarDays, Clock3, ExternalLink, MapPin, MessageCircle, Video } from "lucide-react";
import type { CSSProperties } from "react";
import {
  formatWhatsAppPhone,
  getGoogleMapsEmbedUrl,
  getGoogleMapsSearchUrl,
  getWhatsAppUrl,
  normalizePublicAddress,
} from "@/lib/public-profile";
import { VIRTUAL_PLATFORM_OPTIONS, type ServiceMode, type VirtualPlatform } from "@/lib/virtual-service";
import { VirtualPlatformIcon } from "@/components/virtual-platform-icon";

export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.46 15.04L2.5 21.5l4.58-1.05A9.96 9.96 0 1 0 12.04 2Zm0 1.8a8.16 8.16 0 0 1 6.9 12.5 8.12 8.12 0 0 1-10.95 2.62l-.32-.18-2.45.56.58-2.37-.2-.34A8.1 8.1 0 0 1 12.04 3.8Zm-3.17 3.94c-.18 0-.47.07-.72.34-.25.27-.95.93-.95 2.27 0 1.34.97 2.63 1.1 2.8.14.18 1.88 3.01 4.64 4.1 2.29.9 2.76.72 3.26.68.5-.04 1.62-.66 1.85-1.3.23-.63.23-1.18.16-1.3-.07-.11-.25-.18-.52-.31-.27-.14-1.62-.8-1.87-.89-.25-.09-.43-.14-.61.14-.18.27-.7.89-.86 1.07-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.18-1.34-.8-.72-1.35-1.6-1.51-1.87-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47h-.52Z" />
    </svg>
  );
}

export function PublicBusinessInfo({
  address,
  businessName,
  dateCount,
  schedule,
  serviceMode = "physical",
  virtualPlatforms = [],
  whatsappPhone,
  compact = false,
  themeStyle,
}: {
  address: string | null | undefined;
  businessName: string;
  dateCount: number;
  schedule: string | null;
  serviceMode?: ServiceMode;
  virtualPlatforms?: VirtualPlatform[];
  whatsappPhone: string | null | undefined;
  compact?: boolean;
  themeStyle?: CSSProperties;
}) {
  const normalizedAddress = normalizePublicAddress(address);
  const formattedPhone = formatWhatsAppPhone(whatsappPhone);
  const whatsappUrl = getWhatsAppUrl(whatsappPhone, `Hola ${businessName}, quisiera hacer una consulta.`);
  const isVirtual = serviceMode === "virtual";
  const selectedPlatforms = VIRTUAL_PLATFORM_OPTIONS.filter((option) => virtualPlatforms.includes(option.id));
  const mapsEmbedUrl = isVirtual ? null : getGoogleMapsEmbedUrl(normalizedAddress);
  const mapsSearchUrl = isVirtual ? null : getGoogleMapsSearchUrl(normalizedAddress);
  const hasAvailability = dateCount > 0 || Boolean(schedule);
  const hasLocationPanel = Boolean(mapsEmbedUrl) || (isVirtual && selectedPlatforms.length > 0);

  if (!formattedPhone && !normalizedAddress && !hasAvailability && !isVirtual) return null;

  return (
    <section aria-labelledby="informacion-servicio-titulo" className={`border-b border-line bg-white ${compact ? "py-8" : "py-10 sm:py-14"} ${themeStyle ? "public-theme-active public-theme-info" : ""}`} style={themeStyle}>
      <div className={`mx-auto grid max-w-7xl ${compact ? "gap-6 px-6 sm:px-9" : "gap-8 px-5 sm:px-8 lg:px-10"} ${hasLocationPanel ? compact ? "sm:grid-cols-[.8fr_1.2fr] sm:items-stretch" : "lg:grid-cols-[.78fr_1.22fr] lg:items-stretch" : ""}`}>
        <div className="min-w-0">
          <h2 className={`font-display font-semibold tracking-[-0.035em] ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`} id="informacion-servicio-titulo">Información del servicio</h2>
          <div className={`${compact ? "mt-5" : "mt-7"} divide-y divide-line border-y border-line`}>
            {hasAvailability ? (
              <div className="grid grid-cols-[36px_1fr] gap-3 py-5">
                <CalendarDays aria-hidden="true" className="mt-0.5 text-[var(--booking-brand)]" size={21} />
                <div><p className="font-semibold">Días y horarios</p>{schedule ? <p className="mt-1 flex items-center gap-2 text-sm capitalize text-ink-soft"><Clock3 aria-hidden="true" size={15} />{schedule}</p> : null}</div>
              </div>
            ) : (
              <div className="grid grid-cols-[36px_1fr] gap-3 py-5">
                <CalendarDays aria-hidden="true" className="mt-0.5 text-ink-muted" size={21} />
                <p className="font-semibold text-ink-soft">Sin fechas disponibles</p>
              </div>
            )}
            {whatsappUrl && formattedPhone ? (
              <a className="group grid grid-cols-[36px_1fr] gap-3 py-5 hover:text-[var(--booking-brand)]" href={whatsappUrl} rel="noreferrer" target="_blank">
                <MessageCircle aria-hidden="true" className="mt-0.5 text-[var(--booking-brand)]" size={21} />
                <span><span className="block text-sm text-ink-soft group-hover:text-current">WhatsApp</span><strong className="mt-1 block font-mono tabular-nums">{formattedPhone}</strong></span>
              </a>
            ) : null}
            {isVirtual ? (
              <div className="grid grid-cols-[36px_1fr] gap-3 py-5">
                <Video aria-hidden="true" className="mt-0.5 text-[var(--booking-brand)]" size={21} />
                <div>
                  <p className="text-sm text-ink-soft">Modalidad</p>
                  <p className="mt-1 font-semibold">Servicio virtual</p>
                  {selectedPlatforms.length > 0 ? <p className="mt-1 text-sm leading-6 text-ink-soft">Atención por {selectedPlatforms.map((option) => option.label).join(", ")}.</p> : null}
                </div>
              </div>
            ) : normalizedAddress ? (
              <div className="grid grid-cols-[36px_1fr] gap-3 py-5">
                <MapPin aria-hidden="true" className="mt-0.5 text-[var(--booking-brand)]" size={21} />
                <div><p className="text-sm text-ink-soft">Dirección</p><p className="mt-1 font-semibold leading-6">{normalizedAddress}</p>{mapsSearchUrl ? <a className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--booking-brand)] underline-offset-4 hover:underline" href={mapsSearchUrl} rel="noreferrer" target="_blank">Abrir en Google Maps<ExternalLink aria-hidden="true" size={15} /></a> : null}</div>
              </div>
            ) : null}
          </div>
        </div>
        {isVirtual && selectedPlatforms.length > 0 ? (
          <div aria-label="Plataformas de atención virtual" className={`${compact ? "min-h-[250px] p-5" : "min-h-[320px] p-7 sm:p-9"} flex flex-col justify-center border border-line bg-surface-subtle`}>
            <span className="grid h-12 w-12 place-items-center rounded-md bg-white text-[var(--booking-brand)] shadow-surface"><Video aria-hidden="true" size={24} /></span>
            <p className={`${compact ? "mt-4 text-xl" : "mt-5 text-2xl"} font-display font-semibold tracking-[-0.03em]`}>Atención por videollamada</p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">Al confirmar el turno, el negocio coordinará el acceso a la consulta.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {selectedPlatforms.map((platform) => (
                <div className="flex min-h-16 items-center gap-3 rounded-md border border-line bg-white px-4 py-3 shadow-surface" key={platform.id}>
                  <VirtualPlatformIcon className="h-9 w-9 shrink-0" platform={platform.id} />
                  <strong className="text-sm">{platform.label}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : mapsEmbedUrl ? (
          <div className={`${compact ? "min-h-[250px]" : "min-h-[320px]"} overflow-hidden border border-line bg-surface-subtle`}>
            <iframe allowFullScreen className={`h-full w-full border-0 ${compact ? "min-h-[250px]" : "min-h-[320px]"}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={mapsEmbedUrl} title={`Mapa de ${businessName}`} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
