// Rubros según PRODUCT.md. `value` is stored in businesses.category (free text in the database).
export const BUSINESS_CATEGORIES = [
  { value: "consultorio_clinico", label: "Consultorio clínico u odontológico" },
  { value: "oficina_publica", label: "Oficina gubernamental" },
  { value: "estudio_contable", label: "Estudio contable" },
  { value: "gimnasio", label: "Gimnasio" },
  { value: "escuela_conduccion", label: "Escuela de conducción" },
  { value: "alquiler_canchas", label: "Alquiler de canchas" },
  { value: "estetica", label: "Centro de estética" },
  { value: "otros", label: "Otros negocios con turnos" },
] as const;

// Values written by earlier versions of the onboarding form or by seeds.
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  barberia: "Barbería / peluquería",
  salud: "Consultorio médico",
  spa: "Spa / estética",
  fitness: "Fitness / bienestar",
  clinica_medica: "Clínica médica",
};

export function getBusinessCategoryOptions(current?: string | null) {
  const options: { value: string; label: string }[] = [...BUSINESS_CATEGORIES];
  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: LEGACY_CATEGORY_LABELS[current] ?? current });
  }
  return options;
}
