import { ArrowDownRight, CalendarDays, MapPin, Video } from "lucide-react";
import type { CSSProperties } from "react";
import { getGoogleMapsSearchUrl, normalizePublicAddress } from "@/lib/public-profile";
import { VIRTUAL_PLATFORM_OPTIONS, type ServiceMode, type VirtualPlatform } from "@/lib/virtual-service";
import { RemoteImage } from "@/components/remote-image";

export function PublicEditorialHero({
  businessName,
  description,
  coverImageUrl,
  logoUrl,
  schedule,
  address,
  serviceMode = "physical",
  virtualPlatforms = [],
  compact = false,
  themeStyle,
}: {
  businessName: string;
  description?: string | null;
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  schedule?: string | null;
  address?: string | null;
  serviceMode?: ServiceMode;
  virtualPlatforms?: VirtualPlatform[];
  compact?: boolean;
  themeStyle?: CSSProperties;
}) {
  const normalizedAddress = normalizePublicAddress(address);
  const mapsUrl = serviceMode === "virtual" ? null : getGoogleMapsSearchUrl(normalizedAddress);
  const platforms = VIRTUAL_PLATFORM_OPTIONS.filter((option) => virtualPlatforms.includes(option.id));
  const Heading = compact ? "h2" : "h1";

  return (
    <section aria-label={`Presentación de ${businessName}`} className={`public-editorial-hero ${compact ? "public-editorial-hero-compact" : ""} ${themeStyle ? "public-theme-active public-theme-hero" : ""}`} style={themeStyle}>
      <div className={`public-editorial-media ${coverImageUrl ? "public-editorial-media-photo" : ""}`}>
        {coverImageUrl ? (
          <RemoteImage alt={`Imagen de portada de ${businessName}`} className="object-cover object-center" fill preload={!compact} sizes="(min-width: 1024px) 52vw, 100vw" src={coverImageUrl} />
        ) : logoUrl ? (
          <span className="public-editorial-fallback-logo">
            <RemoteImage alt={`Logo de ${businessName}`} className="object-contain object-center" fill sizes="(min-width: 1024px) 28vw, 60vw" src={logoUrl} />
          </span>
        ) : (
          <span aria-hidden="true" className="public-editorial-monogram">{businessName.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="public-editorial-content">
        <Heading className="public-editorial-title">{businessName}</Heading>
        {description?.trim() ? <p className="public-editorial-description">{description.trim()}</p> : null}
        {schedule || normalizedAddress || serviceMode === "virtual" ? (
          <dl className="public-editorial-facts">
            {schedule ? (
              <div className="public-editorial-fact">
                <CalendarDays aria-hidden="true" size={21} />
                <div><dt>Días y horarios</dt><dd className="capitalize">{schedule}</dd></div>
              </div>
            ) : null}
            {serviceMode === "virtual" ? (
              <div className="public-editorial-fact">
                <Video aria-hidden="true" size={21} />
                <div><dt>Modalidad</dt><dd>Servicio virtual{platforms.length ? ` · ${platforms.map((platform) => platform.label).join(", ")}` : ""}</dd></div>
              </div>
            ) : normalizedAddress ? (
              <div className="public-editorial-fact">
                <MapPin aria-hidden="true" size={21} />
                <div><dt>Ubicación</dt><dd>{mapsUrl ? <a href={mapsUrl} rel="noreferrer" target="_blank">{normalizedAddress}</a> : normalizedAddress}</dd></div>
              </div>
            ) : null}
          </dl>
        ) : null}
        {compact ? (
          <span className="public-editorial-cta">Explorar servicios<ArrowDownRight aria-hidden="true" size={18} /></span>
        ) : (
          <a className="public-editorial-cta" href="#reservar">Explorar servicios<ArrowDownRight aria-hidden="true" size={18} /></a>
        )}
      </div>
    </section>
  );
}
