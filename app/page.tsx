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
import { LogoMark, PrimaryLink, SecondaryLink } from "@/components/ui";

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
  ["¿Qué pasa cuando termina la prueba?", "La prueba dura 7 días. Después podés activar el plan mensual de $15.000 ARS para mantener el acceso completo."],
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
  return (
    <main className="min-h-screen overflow-x-clip bg-white">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <LogoMark />
          <nav aria-label="Navegación principal" className="hidden items-center gap-7 text-sm font-medium text-[var(--color-ink-soft)] lg:flex">
            <a className="hover:text-[var(--color-primary)]" href="#como-funciona">Cómo funciona</a>
            <a className="hover:text-[var(--color-primary)]" href="#funciones">Funciones</a>
            <a className="hover:text-[var(--color-primary)]" href="#rubros">Rubros</a>
            <a className="hover:text-[var(--color-primary)]" href="#precio">Precio</a>
            <a className="hover:text-[var(--color-primary)]" href="#preguntas">Preguntas</a>
          </nav>
          <div className="flex items-center gap-2"><SecondaryLink href="/login">Ingresar</SecondaryLink><span className="hidden sm:inline-flex"><PrimaryLink href="/registro">Crear mi cuenta</PrimaryLink></span></div>
        </div>
      </header>

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
          <div className="grid border border-[var(--color-line)] bg-white shadow-[var(--shadow-surface)] lg:grid-cols-[1.1fr_.9fr]">
            <div className="p-7 sm:p-10"><h2 className="font-display text-4xl font-semibold tracking-[-0.035em] text-[var(--color-navy)] sm:text-5xl">Un solo plan, sin vueltas.</h2><p className="mt-4 max-w-xl leading-7 text-[var(--color-ink-soft)]">Probá todas las funciones durante 7 días. Después, decidí si querés seguir con la suscripción mensual.</p><ul className="mt-8 grid gap-3 sm:grid-cols-2">{["Agenda y servicios", "Clientes", "Página pública", "Señas y estados", "Métricas operativas", "Configuración de marca"].map((item) => <li className="flex items-center gap-2 text-sm font-semibold" key={item}><Check aria-hidden="true" className="text-[var(--color-success)]" size={17} />{item}</li>)}</ul></div>
            <div className="border-t border-[var(--color-line)] bg-[var(--color-primary)] p-7 text-white sm:p-10 lg:border-l lg:border-t-0"><p className="text-sm font-semibold text-white/75">Plan mensual</p><p className="mt-4 font-mono text-5xl font-semibold tracking-[-0.05em]">$15.000</p><p className="mt-2 text-sm text-white/75">ARS por mes</p><Link className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[var(--color-primary)] hover:bg-[#edf3ff]" href="/registro">Comenzar prueba gratis<ArrowRight aria-hidden="true" size={17} /></Link></div>
          </div>
        </section>

        <section className="bg-[var(--color-navy)] text-white"><div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-5 py-18 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12"><div><h2 className="font-display max-w-3xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Tu próxima jornada puede empezar más ordenada.</h2><p className="mt-4 text-white/65">Creá tu cuenta y probá Citadely durante 7 días.</p></div><Link className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-semibold text-[var(--color-navy)]" href="/registro">Crear mi cuenta<ArrowRight aria-hidden="true" size={17} /></Link></div></section>
      </div>

      <footer className="border-t border-white/10 bg-[var(--color-navy)] text-white"><div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 text-sm sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12"><span className="font-semibold">Citadely</span><p className="text-white/65">Central de turnos para negocios de servicios.</p><div className="flex gap-5"><Link className="text-white/70 hover:text-white" href="/login">Ingresar</Link><Link className="text-white/70 hover:text-white" href="/registro">Crear cuenta</Link></div></div></footer>
    </main>
  );
}
