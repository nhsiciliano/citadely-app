import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CalendarCheck,
  CalendarDays,
  CarFront,
  Check,
  Clock3,
  CreditCard,
  Dumbbell,
  Globe2,
  Landmark,
  MousePointerClick,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Stethoscope,
  UsersRound,
  Volleyball,
} from "lucide-react";
import { PrimaryLink } from "@/components/ui";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { HOME_DESCRIPTION, HOME_TITLE, INDEX_ROBOTS, SITE_NAME, SITE_ORIGIN, serializeJsonLd } from "@/lib/seo";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  robots: INDEX_ROBOTS,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    images: [{ url: "/opengraph-image", alt: "Citadely — Agenda y turnos online para negocios" }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [{ url: "/opengraph-image", alt: "Citadely — Agenda y turnos online para negocios" }],
  },
};

const TIMELINE = [
  { time: "09:00", service: "Consulta inicial", client: "Luciana Martínez", state: "Confirmado", tone: "success" },
  { time: "10:30", service: "Corte + color", client: "Camila Fernández", state: "Confirmado", tone: "success" },
  { time: "12:00", service: "Manicura semipermanente", client: "Julieta Rojas", state: "Seña pendiente", tone: "warning" },
  { time: "14:00", service: "Reserva desde tu web", client: "Facundo Pérez", state: "Nuevo", tone: "primary" },
];

const CAPABILITIES = [
  { icon: CalendarDays, title: "Agenda precisa", text: "Vista diaria y semanal, filtros por servicio y estado, y cada turno en su lugar." },
  { icon: Sparkles, title: "Servicios y disponibilidad", text: "Duración, precio, seña y horarios mensuales administrados desde un mismo flujo." },
  { icon: UsersRound, title: "Clientes accesibles", text: "Búsqueda local y fichas claras para crear turnos sin volver a pedir los mismos datos." },
  { icon: CreditCard, title: "Señas bajo control", text: "Estados pendientes y confirmados con alias, CBU o CVU propio de cada negocio." },
  { icon: Globe2, title: "Reservas públicas", text: "Una página con la marca del negocio para elegir servicio, fecha, hora y confirmar." },
];

const INDUSTRIES = [
  { name: "Consultorios clínicos", icon: Stethoscope },
  { name: "Centros odontológicos", icon: SmilePlus },
  { name: "Oficinas gubernamentales", icon: Landmark },
  { name: "Estudios contables", icon: Calculator },
  { name: "Gimnasios", icon: Dumbbell },
  { name: "Escuelas de conducción", icon: CarFront },
  { name: "Alquiler de canchas", icon: Volleyball },
  { name: "Centros de estética", icon: Sparkles },
];

const FAQS = [
  ["¿Necesito instalar algo?", "No. Citadely funciona desde el navegador, tanto en escritorio como en dispositivos móviles."],
  ["¿Cómo reciben turnos mis clientes?", "Compartís la página pública de tu negocio. El cliente elige servicio, fecha y hora, completa sus datos y confirma la reserva."],
  ["¿Cómo funcionan las señas?", "Configurás el monto por servicio y tus datos de transferencia. Luego confirmás la recepción desde el turno."],
  ["¿Puedo usarlo para distintos tipos de servicios?", "Sí. La agenda se organiza por días y horarios, por lo que se adapta a negocios profesionales, de salud, deporte, educación y bienestar."],
  ["¿Qué pasa cuando termina la prueba?", "La prueba dura 7 días e incluye todas las funciones Pro. Después elegís Esencial por $14.000 ARS o Pro por $18.000 ARS al mes."],
];

function DemoTimeline() {
  return (
    <figure className="mx-auto w-full max-w-[610px]">
      <div className="relative pl-11 sm:pl-16">
        <span aria-hidden="true" className="absolute bottom-7 left-[18px] top-4 w-px bg-[var(--color-primary)] sm:left-[30px]" />
        <span className="absolute left-0 top-0 grid h-9 min-w-9 place-items-center rounded-full bg-[var(--color-primary)] px-2 font-mono text-[10px] font-bold text-white sm:left-3">HOY</span>
        <div className="grid gap-3">
          {TIMELINE.map((item, index) => (
            <div className="relative grid grid-cols-[54px_minmax(0,1fr)] items-start gap-3" key={`${item.time}-${item.service}`}>
              <span aria-hidden="true" className={`absolute -left-[34px] top-6 h-3 w-3 rounded-full border-[3px] border-white ring-2 sm:-left-[40px] ${index === TIMELINE.length - 1 ? "bg-[var(--color-primary)] ring-[var(--color-primary)]" : "bg-white ring-[var(--color-primary)]"}`} />
              <time className="pt-4 font-mono text-xs font-semibold text-[var(--color-ink-soft)]">{item.time}</time>
              <div className="border border-[var(--color-line)] bg-white p-4 shadow-[var(--shadow-surface)]">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-semibold">{item.service}</p><p className="mt-1 text-xs text-[var(--color-ink-soft)]">{item.client}</p></div>
                  <span className={`status-badge ${item.tone === "success" ? "status-confirmed" : item.tone === "warning" ? "status-pending_payment" : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"}`}>{item.state}</span>
                </div>
                {item.tone === "warning" ? <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line)] pt-3 text-xs"><span className="text-[var(--color-warning)]">Seña $8.000</span><span className="font-semibold text-[var(--color-primary)]">Revisar reserva</span></div> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-5 text-right text-xs text-[var(--color-ink-muted)]">Ejemplo de jornada · datos ficticios</figcaption>
    </figure>
  );
}

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: SITE_NAME,
        url: SITE_ORIGIN,
        logo: `${SITE_ORIGIN}/icon.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: SITE_NAME,
        url: SITE_ORIGIN,
        inLanguage: "es-AR",
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: SITE_ORIGIN,
        description: HOME_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "es-AR",
        offers: Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
          "@type": "Offer",
          name: `Plan ${plan.name}`,
          price: String(plan.priceCents / 100),
          priceCurrency: "ARS",
          url: `${SITE_ORIGIN}/#precio`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-white">
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        type="application/ld+json"
      />
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <MarketingHeader />

      <div id="contenido">
        <section className="relative border-b border-[var(--color-line)] bg-[var(--color-surface-subtle)]">
          <div aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-px bg-[var(--color-line)] lg:block" />
          <div className="mx-auto grid min-h-[700px] max-w-[1440px] lg:grid-cols-2">
            <div className="flex items-center px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
              <div className="max-w-[620px]">
                <h1 className="font-display text-[clamp(3rem,5vw,3.4rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-[var(--color-navy)]">Tomá el control de cada jornada.</h1>
                <p className="mt-7 max-w-[460px] text-lg leading-8 text-[var(--color-ink-soft)]">Citadely es tu central de turnos: reúne agenda, servicios, clientes, reservas públicas y estados de seña. Menos idas y vueltas; más precisión para operar tu negocio.</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row"><PrimaryLink href="/registro">Crear mi cuenta</PrimaryLink><a className="button-secondary" href="#como-funciona">Ver cómo funciona<ArrowRight aria-hidden="true" size={16} /></a></div>
                <p className="mt-5 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]"><ShieldCheck aria-hidden="true" className="text-[var(--color-success)]" size={17} />Probá gratis durante 7 días.</p>
              </div>
            </div>
            <div className="flex items-center bg-white px-5 py-12 sm:px-8 lg:px-12 lg:py-16"><DemoTimeline /></div>
          </div>
        </section>

        <section className="border-b border-[var(--color-line)] bg-white" id="como-funciona">
          <div className="mx-auto max-w-[1440px] px-5 pb-8 pt-4 sm:px-8 lg:px-12">
            <div className="text-center">
              <h2 className="font-display text-2xl font-semibold tracking-[-0.035em] text-[var(--color-navy)] sm:text-3xl">De la reserva al horario confirmado.</h2>
              <p className="mx-auto mt-3 max-w-2xl leading-7 text-[var(--color-ink-soft)]">El mismo flujo conecta lo que hace el cliente con lo que necesita resolver el responsable del negocio.</p>
            </div>
            <ol className="mt-6 grid border-l border-t border-[var(--color-line)] sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [MousePointerClick, "Elegí servicio", "El cliente encuentra la opción correcta en la página pública."],
                  [Clock3, "Seleccioná fecha y hora", "La disponibilidad publicada evita intercambios manuales."],
                  [CreditCard, "Confirmá la seña", "Las instrucciones y el estado quedan asociados a la reserva."],
                  [CalendarCheck, "Operá la jornada", "El turno aparece en agenda con toda la información necesaria."],
                ].map(([Icon, title, text]) => {
                  const StepIcon = Icon as typeof MousePointerClick;
                  return <li className="border-b border-r border-[var(--color-line)] p-6" key={String(title)}><StepIcon aria-hidden="true" className="text-[var(--color-primary)]" size={24} /><h3 className="mt-6 font-semibold text-[var(--color-ink)]">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[var(--color-ink-soft)]">{String(text)}</p></li>;
                })}
              </ol>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28" id="funciones">
          <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]">
            <div><h2 className="font-display text-4xl font-semibold tracking-[-0.035em] text-[var(--color-navy)] sm:text-5xl">Todo lo necesario para mantener el ritmo.</h2><p className="mt-5 max-w-md leading-7 text-[var(--color-ink-soft)]">Cada módulo responde una pregunta concreta de la operación, sin sumar complejidad innecesaria.</p></div>
            <div className="border-t border-[var(--color-line)]">
              {CAPABILITIES.map(({ icon: Icon, title, text }) => <article className="grid gap-4 border-b border-[var(--color-line)] py-6 sm:grid-cols-[40px_190px_1fr] sm:items-start" key={title}><span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Icon aria-hidden="true" size={19} /></span><h3 className="font-semibold">{title}</h3><p className="text-sm leading-6 text-[var(--color-ink-soft)]">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section aria-labelledby="rubros-title" className="border-y border-[var(--color-line)] bg-[var(--color-canvas)]" id="rubros">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-display text-balance text-3xl font-semibold tracking-[-0.035em] text-[var(--color-navy)] sm:text-5xl" id="rubros-title">Una central para distintos tipos de turnos.</h2>
              <p className="mx-auto mt-5 max-w-2xl text-pretty leading-7 text-[var(--color-ink-soft)]">Configuralo según los servicios, precios, señas y horarios de tu negocio. La estructura operativa se mantiene clara en cualquier rubro.</p>
            </div>
            <ul className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-x-5 gap-y-10 sm:mt-16 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-4">
              {INDUSTRIES.map(({ name, icon: Icon }) => (
                <li className="flex min-w-0 flex-col items-center gap-4 text-center" key={name}>
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-white text-[var(--color-primary)]">
                    <Icon aria-hidden="true" size={32} strokeWidth={1.75} />
                  </span>
                  <span className="min-h-12 max-w-44 text-balance text-sm font-semibold leading-6 text-[var(--color-navy)] sm:text-base">{name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid overflow-hidden border border-[var(--color-line)] bg-white shadow-[var(--shadow-raised)] lg:grid-cols-[.9fr_1.1fr]">
            <div className="bg-[var(--color-navy)] p-7 text-white sm:p-10"><h2 className="font-display text-4xl font-semibold tracking-[-0.035em]">Una página de reservas con la identidad de tu negocio.</h2><p className="mt-5 max-w-md leading-7 text-white/68">Logo, portada, descripción y color propio. Citadely queda en segundo plano para que tu marca lidere.</p><div className="mt-9 space-y-4">{["Servicio", "Fecha y hora", "Datos", "Confirmación"].map((step, index) => <div className="flex items-center gap-4" key={step}><span className="grid h-8 w-8 place-items-center rounded-full border border-white/25 font-mono text-xs">{index + 1}</span><span className="font-semibold">{step}</span></div>)}</div></div>
            <div className="bg-[var(--color-surface-subtle)] p-6 sm:p-10"><div className="border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-surface)]"><div className="flex items-center justify-between border-b border-[var(--color-line)] pb-4"><div><p className="text-lg font-semibold">Estudio Norte</p><p className="mt-1 text-xs text-[var(--color-ink-soft)]">Reservá tu próximo turno</p></div><span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--color-primary)] font-semibold text-white">E</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button className="border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-4 text-left" type="button"><strong className="text-sm">Consulta inicial</strong><span className="mt-1 block text-xs text-[var(--color-ink-soft)]">45 min · $20.000</span></button><button className="border border-[var(--color-line)] p-4 text-left" type="button"><strong className="text-sm">Seguimiento</strong><span className="mt-1 block text-xs text-[var(--color-ink-soft)]">30 min · $15.000</span></button></div><div className="mt-5 grid grid-cols-4 gap-2">{["10:00", "11:30", "14:00", "16:30"].map((time) => <button className="rounded-md border border-[var(--color-line)] px-2 py-3 font-mono text-xs font-semibold hover:border-[var(--color-primary)]" key={time} type="button">{time}</button>)}</div><button className="button-primary mt-5 w-full" type="button">Continuar<ArrowRight aria-hidden="true" size={16} /></button></div></div>
          </div>
        </section>

        <section className="border-y border-[var(--color-line)] bg-[var(--color-surface-subtle)]" id="preguntas">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:px-12">
            <div><h2 className="font-display text-4xl font-semibold tracking-[-0.035em] text-[var(--color-navy)]">Preguntas frecuentes</h2><p className="mt-4 leading-7 text-[var(--color-ink-soft)]">Lo esencial antes de empezar a organizar tus turnos.</p></div>
            <div className="border-t border-[var(--color-line)]">{FAQS.map(([question, answer]) => <details className="group border-b border-[var(--color-line)]" key={question}><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 font-semibold">{question}<span aria-hidden="true" className="text-[var(--color-primary)] group-open:rotate-45">+</span></summary><p className="max-w-2xl pb-6 text-sm leading-6 text-[var(--color-ink-soft)]">{answer}</p></details>)}</div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28" id="precio">
          <div className="mb-10 max-w-3xl"><h2 className="font-display text-4xl font-semibold tracking-[-0.035em] text-[var(--color-navy)] sm:text-5xl">Dos planes para administrar y crecer.</h2><p className="mt-4 max-w-2xl leading-7 text-[var(--color-ink-soft)]">Empezá con 7 días de Pro. Después elegí si necesitás el dashboard o también una página pública que reciba reservas.</p></div>
          <div className="grid border border-[var(--color-line)] bg-white shadow-[var(--shadow-surface)] lg:grid-cols-2">
            {Object.values(SUBSCRIPTION_PLANS).map((plan) => <article className={`p-7 sm:p-10 ${plan.id === "pro" ? "border-t border-[var(--color-line)] bg-[var(--color-navy)] text-white lg:border-l lg:border-t-0" : ""}`} key={plan.id}><div className="flex items-center justify-between gap-4"><h3 className="font-display text-3xl font-semibold">{plan.name}</h3>{plan.id === "pro" ? <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">Reservas online</span> : null}</div><p className={`mt-3 min-h-12 text-sm leading-6 ${plan.id === "pro" ? "text-white/70" : "text-[var(--color-ink-soft)]"}`}>{plan.description}</p><p className="mt-7 font-mono text-4xl font-semibold tracking-[-0.04em]">${(plan.priceCents / 100).toLocaleString("es-AR")}</p><p className={`mt-1 text-sm ${plan.id === "pro" ? "text-white/70" : "text-[var(--color-ink-muted)]"}`}>ARS por mes</p><ul className="mt-7 grid gap-3">{plan.features.map((item) => <li className="flex items-center gap-2 text-sm font-semibold" key={item}><Check aria-hidden="true" className={plan.id === "pro" ? "text-white" : "text-[var(--color-success)]"} size={17} />{item}</li>)}</ul><Link className={`mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold ${plan.id === "pro" ? "bg-white text-[var(--color-navy)] hover:bg-[var(--color-surface-subtle)]" : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"}`} href="/registro">Probar Pro durante 7 días<ArrowRight aria-hidden="true" size={17} /></Link></article>)}
          </div>
        </section>

        <section className="bg-[var(--color-navy)] text-white"><div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-5 py-18 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12"><div><h2 className="font-display max-w-3xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Tu próxima jornada puede empezar más ordenada.</h2><p className="mt-4 text-white/65">Creá tu cuenta y probá Citadely durante 7 días.</p></div><Link className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-semibold text-[var(--color-navy)]" href="/registro">Crear mi cuenta<ArrowRight aria-hidden="true" size={17} /></Link></div></section>
      </div>

      <MarketingFooter />
    </main>
  );
}
