"use client";

import { useId, useState, type CSSProperties } from "react";
import { ArrowUpRight, Plus } from "lucide-react";

type Faq = { id: string; question: string; answer: string };

export function PublicFaqs({ faqs, compact = false, contactUrl, themeStyle }: { faqs: Faq[]; compact?: boolean; contactUrl?: string | null; themeStyle?: CSSProperties }) {
  const headingId = useId();
  const Heading = compact ? "h3" : "h2";
  if (!faqs.length) return null;
  return (
    <section aria-labelledby={headingId} className={`border-b border-[var(--color-line)] bg-[var(--color-surface-subtle)] ${compact ? "px-4 py-9 sm:px-8" : "px-5 py-16 sm:px-8 sm:py-20"} ${themeStyle ? "public-theme-active public-theme-faq" : ""}`} style={themeStyle}>
      <div className={`mx-auto w-full ${compact ? "max-w-2xl" : "max-w-[780px]"}`}>
        <Heading className={`text-center font-display font-semibold tracking-[-0.04em] text-[var(--color-ink)] ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`} id={headingId}>Preguntas frecuentes</Heading>
        <div className={`public-faq-list ${compact ? "public-faq-list-compact" : ""}`}>
          {faqs.map((faq, index) => <FaqItem faq={faq} initiallyOpen={index === 0} key={faq.id} level={compact ? "h4" : "h3"} />)}
        </div>
        {contactUrl ? <div className="mt-8 flex justify-center"><a className="public-faq-contact" href={contactUrl} rel="noreferrer" target="_blank">Hacer una consulta<ArrowUpRight aria-hidden="true" size={18} /></a></div> : null}
      </div>
    </section>
  );
}

function FaqItem({ faq, initiallyOpen, level }: { faq: Faq; initiallyOpen: boolean; level: "h3" | "h4" }) {
  const Question = level;
  const [open, setOpen] = useState(initiallyOpen);
  const buttonId = useId();
  const panelId = useId();
  return (
    <div className="public-faq-item">
      <Question><button aria-controls={panelId} aria-expanded={open} className="public-faq-question" id={buttonId} onClick={() => setOpen((current) => !current)} type="button"><span className="min-w-0 break-words">{faq.question}</span><span aria-hidden="true" className="public-faq-icon"><Plus className={open ? "public-faq-icon-open" : ""} size={20} /></span></button></Question>
      <div aria-hidden={!open} aria-labelledby={buttonId} className={`public-faq-answer ${open ? "public-faq-answer-open" : ""}`} id={panelId} role="region"><div><p className="whitespace-pre-line break-words">{faq.answer}</p></div></div>
    </div>
  );
}
