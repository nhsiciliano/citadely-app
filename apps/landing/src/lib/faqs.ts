// Shared by the FAQ section and the FAQPage JSON-LD in src/pages/index.astro, so both say the same.
export const FAQS = [
  { question: "¿Necesito instalar algo?", answer: "No. Citadely funciona desde el navegador, tanto en escritorio como en dispositivos móviles." },
  { question: "¿Cómo reciben turnos mis clientes?", answer: "Compartís la página pública de tu negocio. El cliente elige servicio, fecha y hora, completa sus datos y confirma la reserva." },
  { question: "¿Cómo funcionan las señas?", answer: "Configurás el monto por servicio y tus datos de transferencia. Luego confirmás la recepción desde el turno." },
  { question: "¿Puedo usarlo para distintos tipos de servicios?", answer: "Sí. La agenda se organiza por días y horarios, por lo que se adapta a negocios profesionales, de salud, deporte, educación y bienestar." },
  { question: "¿Cuánto cuesta Citadely?", answer: "Nada. Todas las funciones están incluidas. Los aportes voluntarios desde Configuración sostienen el proyecto y no desbloquean funciones." },
] as const;
