import { CircleHelp, Plus, Trash2 } from "lucide-react";
import type { BusinessFaq } from "@/lib/citadely-db";

export type DraftFaq = Omit<Pick<BusinessFaq, "id" | "question" | "answer" | "sort_order">, "id"> & { id?: string; localId: string };

export function FaqSection({
  faqs,
  onChange,
}: {
  faqs: DraftFaq[];
  onChange: (update: (current: DraftFaq[]) => DraftFaq[]) => void;
}) {
  return (
    <section className="surface-section">
    <div className="section-heading-row"><div><h2>Preguntas frecuentes</h2><p>Hasta 10 preguntas con respuesta.</p></div><CircleHelp aria-hidden="true" className="text-primary" size={21} /></div>
    <div className="grid gap-4">
      {faqs.map((faq, index) => (
        <fieldset className="grid gap-3 border-b border-line pb-4 last:border-b-0" key={faq.localId}>
          <legend className="sr-only">Pregunta frecuente {index + 1}</legend>
          <div className="flex items-center justify-between gap-3"><strong className="text-sm">Pregunta {index + 1}</strong><button aria-label={`Eliminar pregunta ${index + 1}`} className="button-secondary h-12 w-12 shrink-0 px-0 text-danger" onClick={() => onChange((current) => current.filter((item) => item.localId !== faq.localId))} type="button"><Trash2 aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.5} /></button></div>
          <label className="form-label">Pregunta<input className="form-control" maxLength={180} onChange={(event) => onChange((current) => current.map((item) => item.localId === faq.localId ? { ...item, question: event.target.value } : item))} placeholder="¿Cómo reservo un turno?" required value={faq.question} /></label>
          <label className="form-label">Respuesta<textarea className="form-control min-h-24 resize-y" maxLength={1200} onChange={(event) => onChange((current) => current.map((item) => item.localId === faq.localId ? { ...item, answer: event.target.value } : item))} placeholder="Elegí un servicio, fecha y horario disponible." required value={faq.answer} /></label>
        </fieldset>
      ))}
      {faqs.length === 0 ? <p className="border border-dashed border-line-strong bg-surface-subtle p-5 text-sm text-ink-soft">Todavía no cargaste preguntas.</p> : null}
      <button className="button-secondary w-full" disabled={faqs.length >= 10} onClick={() => onChange((current) => [...current, { localId: crypto.randomUUID(), question: "", answer: "", sort_order: -1 }])} type="button"><Plus aria-hidden="true" size={16} />Agregar pregunta</button>
    </div>
    </section>
  );
}
