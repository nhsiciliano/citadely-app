import { Tag } from "lucide-react";
import { Field } from "@/components/ui";
import type { Service } from "@/lib/citadely-db";
import { currencyInputValue } from "@/lib/service-availability";
import { SERVICE_LIMITS } from "@/lib/service-form";

/** "Datos del servicio" section of the service drawer (uncontrolled inputs read by readServiceForm). */
export function ServiceFormFields({ editingService }: { editingService: Service | null }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-2 border-b border-line pb-3"><Tag aria-hidden="true" className="text-primary" size={18} /><h3 className="font-semibold">Datos del servicio</h3></div>
      <Field defaultValue={editingService?.name} label="Nombre" maxLength={SERVICE_LIMITS.nameMax} name="name" placeholder="Consulta clínica general" />
      <Field defaultValue={editingService?.description ?? ""} label="Descripción" name="description" placeholder="Qué incluye o cómo prepararse" required={false} />
      <Field defaultValue={editingService?.image_url ?? ""} label="Imagen del servicio" name="image_url" placeholder="https://…" required={false} type="url" />
      <div className="grid gap-4 sm:grid-cols-2"><Field defaultValue={editingService ? String(editingService.duration_minutes) : "30"} inputMode="numeric" label="Duración en minutos" max={SERVICE_LIMITS.durationMax} min={SERVICE_LIMITS.durationMin} name="duration_minutes" step={1} type="number" /><Field defaultValue={editingService ? currencyInputValue(editingService.price_cents) : "0"} inputMode="decimal" label="Precio" min={0} name="price" step="0.01" type="number" /></div>
      <label className="form-label">Cobro al reservar<select className="form-control" defaultValue={editingService?.deposit_type ?? "free"} name="deposit_type"><option value="free">Reserva gratuita</option><option value="deposit">Seña configurable</option><option value="full">Seña del 100%</option></select></label>
      <Field defaultValue={editingService ? currencyInputValue(editingService.deposit_value_cents) : "0"} inputMode="decimal" label="Monto de seña" min={0} name="deposit_value" required={false} step="0.01" type="number" />
    </section>
  );
}
