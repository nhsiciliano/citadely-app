"use client";

import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  PUBLIC_THEME_LABELS,
  PUBLIC_THEME_SECTIONS,
  defaultSectionColors,
  isHexColor,
  resolveSectionColors,
  type PublicTheme,
  type PublicThemeSection,
  type SectionColors,
} from "@/lib/public-theme";

function ColorControl({ label, color, fallback, onChange }: {
  label: string;
  color: string | undefined;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const text = editing ?? color ?? fallback;
  const valid = isHexColor(text);

  return (
    <div className="grid gap-2">
      <label className="text-xs font-semibold text-[var(--color-ink-soft)]" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input aria-label={`${label}: selector visual`} className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-[var(--color-line)] bg-white p-1" onChange={(event) => { setEditing(null); onChange(event.target.value); }} type="color" value={valid ? text : color ?? fallback} />
        <input aria-invalid={!valid} className="form-control h-11 min-w-0 flex-1 font-mono text-sm uppercase" id={id} maxLength={7} onBlur={() => { if (valid) setEditing(null); }} onChange={(event) => {
          const next = event.target.value;
          setEditing(next);
          if (isHexColor(next)) onChange(next.toLowerCase());
        }} onInvalid={(event) => event.currentTarget.closest("details")?.setAttribute("open", "")} pattern="#[0-9a-fA-F]{6}" required spellCheck={false} type="text" value={text} />
      </div>
      {!valid ? <span className="text-xs text-[var(--color-danger)]">Usá un color hexadecimal de 6 caracteres, por ejemplo #0957D9.</span> : null}
    </div>
  );
}

export function PublicThemeEditor({ theme, brandColor, onChange }: {
  theme: PublicTheme;
  brandColor: string;
  onChange: (next: PublicTheme) => void;
}) {
  const [resetVersion, setResetVersion] = useState(0);

  function updateSection(section: PublicThemeSection, field: keyof SectionColors, value: string) {
    onChange({ ...theme, [section]: { ...theme[section], [field]: value } });
  }

  function resetSection(section: PublicThemeSection) {
    const next = { ...theme };
    delete next[section];
    onChange(next);
    setResetVersion((version) => version + 1);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm leading-6 text-[var(--color-ink-soft)]">Elegí fondo y acento. La vista previa se actualiza al instante; los colores se publican al guardar.</p>
        <button className="button-secondary" disabled={Object.keys(theme).length === 0} onClick={() => { onChange({}); setResetVersion((version) => version + 1); }} type="button"><RotateCcw aria-hidden="true" size={16} />Restaurar todos</button>
      </div>
      <div className="grid gap-3">
        {PUBLIC_THEME_SECTIONS.map((section) => {
          const defaults = defaultSectionColors(section, brandColor);
          const applied = resolveSectionColors(section, theme, brandColor);
          const customized = Boolean(theme[section]);
          return (
            <details className="group rounded-lg border border-[var(--color-line)] bg-white" key={section}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="flex shrink-0 overflow-hidden rounded-full border border-[var(--color-line-strong)]"><span className="h-6 w-6" style={{ backgroundColor: applied.background }} /><span className="h-6 w-6" style={{ backgroundColor: applied.accent }} /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{PUBLIC_THEME_LABELS[section]}</span>
                <span className="text-xs text-[var(--color-ink-muted)]">{customized ? "Personalizado" : "Predeterminado"}</span>
                <span aria-hidden="true" className="text-[var(--color-ink-muted)] transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="border-t border-[var(--color-line)] px-4 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorControl color={theme[section]?.background} fallback={defaults.background} key={`${section}-background-${resetVersion}`} label={`Fondo de ${PUBLIC_THEME_LABELS[section]}`} onChange={(value) => updateSection(section, "background", value)} />
                  <ColorControl color={theme[section]?.accent} fallback={defaults.accent} key={`${section}-accent-${resetVersion}`} label={`Acento de ${PUBLIC_THEME_LABELS[section]}`} onChange={(value) => updateSection(section, "accent", value)} />
                </div>
                {applied.accent.toLowerCase() !== applied.requestedAccent.toLowerCase() ? <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">Acento aplicado: <strong className="font-mono">{applied.accent.toUpperCase()}</strong>. Se ajustó para distinguirse del fondo.</p> : null}
                <button className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-primary)] disabled:cursor-not-allowed disabled:text-[var(--color-ink-muted)]" disabled={!customized} onClick={() => resetSection(section)} type="button"><RotateCcw aria-hidden="true" size={15} />Restaurar sección</button>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
