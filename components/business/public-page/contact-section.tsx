import { MapPinned, Video } from "lucide-react";
import { VirtualPlatformIcon } from "@/components/virtual-platform-icon";
import { VIRTUAL_PLATFORM_OPTIONS, type ServiceMode, type VirtualPlatform } from "@/lib/virtual-service";

export function ContactSection({
  onPublicAddressChange,
  onServiceModeChange,
  onVirtualPlatformsChange,
  onWhatsappPhoneChange,
  publicAddress,
  serviceMode,
  virtualPlatforms,
  whatsappPhone,
}: {
  onPublicAddressChange: (value: string) => void;
  onServiceModeChange: (mode: ServiceMode) => void;
  onVirtualPlatformsChange: (update: (current: VirtualPlatform[]) => VirtualPlatform[]) => void;
  onWhatsappPhoneChange: (value: string) => void;
  publicAddress: string;
  serviceMode: ServiceMode;
  virtualPlatforms: VirtualPlatform[];
  whatsappPhone: string;
}) {
  return (
    <section className="surface-section">
      <div className="section-heading-row"><div><h2>Contacto y modalidad</h2><p>Indicá cómo se realizan los turnos.</p></div>{serviceMode === "virtual" ? <Video aria-hidden="true" className="text-primary" size={21} /> : <MapPinned aria-hidden="true" className="text-primary" size={21} />}</div>
      <div className="grid gap-5">
        <fieldset>
          <legend className="form-label">Tipo de atención</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors ${serviceMode === "physical" ? "border-primary bg-primary-soft text-primary" : "border-line bg-white hover:border-line-strong"}`}>
              <input checked={serviceMode === "physical"} className="h-4 w-4 accent-primary" name="service_mode" onChange={() => onServiceModeChange("physical")} type="radio" value="physical" />
              <span><MapPinned aria-hidden="true" size={20} /><strong className="mt-1 block text-sm text-ink">Dirección física</strong></span>
            </label>
            <label className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors ${serviceMode === "virtual" ? "border-primary bg-primary-soft text-primary" : "border-line bg-white hover:border-line-strong"}`}>
              <input checked={serviceMode === "virtual"} className="h-4 w-4 accent-primary" name="service_mode" onChange={() => onServiceModeChange("virtual")} type="radio" value="virtual" />
              <span><Video aria-hidden="true" size={20} /><strong className="mt-1 block text-sm text-ink">Servicio virtual</strong></span>
            </label>
          </div>
        </fieldset>
        <label className="form-label">WhatsApp de contacto<input autoComplete="tel" className="form-control" inputMode="tel" maxLength={24} name="whatsapp_phone" onChange={(event) => onWhatsappPhoneChange(event.target.value)} placeholder="5491123456789" type="tel" value={whatsappPhone} /></label>
        <p className="-mt-3 text-xs leading-5 text-ink-muted">Código de país, sin +, espacios ni guiones.</p>
        {serviceMode === "physical" ? (
          <>
            <label className="form-label">Dirección pública<input autoComplete="street-address" className="form-control" maxLength={300} name="public_address" onChange={(event) => onPublicAddressChange(event.target.value)} placeholder="Av. Corrientes 1234, CABA" value={publicAddress} /></label>
            <p className="-mt-3 text-xs leading-5 text-ink-muted">Usamos esta dirección para generar el mapa de Google Maps.</p>
          </>
        ) : (
          <fieldset>
            <legend className="form-label">Plataformas disponibles</legend>
            <div className="grid gap-3">
              {VIRTUAL_PLATFORM_OPTIONS.map((platform) => {
                const checked = virtualPlatforms.includes(platform.id);
                return (
                  <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${checked ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-line-strong"}`} key={platform.id}>
                    <input
                      checked={checked}
                      className="h-4 w-4 accent-primary"
                      onChange={() => onVirtualPlatformsChange((current) => checked ? current.filter((item) => item !== platform.id) : [...current, platform.id])}
                      type="checkbox"
                    />
                    <VirtualPlatformIcon className="h-8 w-8 shrink-0" platform={platform.id} />
                    <strong className="text-sm">{platform.label}</strong>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-muted">Podés seleccionar una o varias opciones.</p>
          </fieldset>
        )}
      </div>
    </section>
  );
}
