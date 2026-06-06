import { LogoMark, PrimaryLink, SecondaryLink } from "@/components/ui";

const metrics = [
  ["Reservas publicas", "24/7", "sin cuenta de cliente"],
  ["Señas", "CBU/CVU", "instrucciones por negocio"],
  ["Agenda", "Mensual", "slots exactos por servicio"],
];

const segments = ["Salud", "Deporte", "Servicios", "Tramites", "Bienestar"];

const useCases = [
  {
    title: "Clinicas y consultorios medicos",
    tag: "Salud",
    text: "Agendamiento de citas con medicos generales, pediatras, cardiologos y otras especialidades.",
  },
  {
    title: "Centros odontologicos",
    tag: "Dental",
    text: "Reservas para limpiezas, ortodoncia, cirugias y revisiones de rutina.",
  },
  {
    title: "Estudios de tatuajes y piercings",
    tag: "Diseño",
    text: "Agendamiento de sesiones de diseño, perforaciones y consultas previas.",
  },
  {
    title: "Alquiler de canchas",
    tag: "Deporte",
    text: "Turnos para futbol, tenis, padel, squash o basquetbol.",
  },
  {
    title: "Estudios juridicos y contables",
    tag: "Profesional",
    text: "Asesorias, consultas legales y reuniones de planificacion fiscal con abogados, contadores o escribanos.",
  },
  {
    title: "Oficinas gubernamentales",
    tag: "Tramites",
    text: "Renovacion de documento, pasaporte, licencia de conducir o gestiones impositivas.",
  },
  {
    title: "Escuelas de conduccion",
    tag: "Clases",
    text: "Agendamiento de clases practicas de manejo y examenes simulados.",
  },
  {
    title: "Gimnasios y centros de fitness",
    tag: "Fitness",
    text: "Reserva de cupos en clases grupales como spinning, yoga, pilates o crossfit para controlar el aforo.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--agenda-paper)]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <LogoMark />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--ink-soft)] md:flex">
          <a className="hover:text-[var(--ink)]" href="#producto">Producto</a>
          <a className="hover:text-[var(--ink)]" href="#reservas">Reservas</a>
          <a className="hover:text-[var(--ink)]" href="#rubros">Rubros</a>
          <a className="hover:text-[var(--ink)]" href="#pagos">Pagos</a>
        </nav>
        <div className="flex items-center gap-3">
          <SecondaryLink href="/login">Ingresar</SecondaryLink>
          <div className="hidden sm:block">
            <PrimaryLink href="/registro">Crear cuenta</PrimaryLink>
          </div>
        </div>
      </header>

      <section className="agenda-grid mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
        <div className="max-w-3xl">
          <div className="mb-6 flex flex-wrap gap-2">
            {segments.map((segment) => (
              <span
                className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]"
                key={segment}
              >
                {segment}
              </span>
            ))}
          </div>
          <h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.07em] text-[var(--ink)] sm:text-7xl lg:text-8xl">
            Gestiona tus citas con elegancia y control.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">
            Citadely centraliza servicios, disponibilidad mensual, clientes y reservas publicas para negocios que trabajan con turnos. Una pagina para recibir reservas y un panel privado para operar cada dia.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <PrimaryLink href="/registro">Comenzar gratis</PrimaryLink>
            <SecondaryLink href="/login">Ya tengo cuenta</SecondaryLink>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--line-strong)] bg-[var(--surface)] p-3 shadow-sm sm:p-5">
          <div className="grid overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-raised)] shadow-sm sm:grid-cols-[72px_1fr]">
            <aside className="hidden bg-[var(--ink)] p-4 sm:grid sm:content-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-lg font-semibold text-white">C</div>
              <div className="grid gap-4">
                {["01", "02", "03"].map((item) => (
                  <span className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-semibold ${item === "01" ? "bg-[var(--reception)] text-white" : "border border-white/10 text-white/45"}`} key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </aside>
            <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--terracotta)]">
                  Agenda de hoy
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Consultorio Norte</h2>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">78% ocupada</p>
                <div className="mt-2 h-1.5 w-24 rounded-full bg-[var(--agenda-paper-deep)]">
                  <span className="block h-full w-[78%] rounded-full bg-[var(--reception)]" />
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4">
              {[
                ["09:00", "Consulta inicial", "Mateo", "Confirmada"],
                ["10:30", "Revision", "Lucia", "Seña paga"],
                ["12:00", "Control", "Ana", "Recordatorio"],
                ["15:00", "Hueco disponible", "", "Publico"],
              ].map(([time, service, client, state]) => (
                <div className="grid grid-cols-[58px_1fr] gap-4" key={`${time}-${service}`}>
                  <span className="number-tabular pt-3 text-sm font-semibold text-[var(--ink-muted)]">{time}</span>
                  <div className={`rounded-2xl border bg-white/70 p-4 ${state === "Confirmada" ? "border-[var(--reception)]" : "border-[var(--line)]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--ink)]">{service}</p>
                        {client ? <p className="mt-1 text-sm text-[var(--ink-soft)]">Cliente: {client}</p> : null}
                      </div>
                      <span className="rounded-full bg-[var(--agenda-paper-deep)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]">
                        {state}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      </section>

      <section id="producto" className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:px-8 md:grid-cols-3">
        {metrics.map(([label, value, hint]) => (
          <article className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm" key={label}>
            <p className="text-sm font-semibold text-[var(--ink-soft)]">{label}</p>
            <p className="number-tabular mt-5 text-4xl font-semibold tracking-[-0.06em]">{value}</p>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">{hint}</p>
          </article>
        ))}
      </section>

      <section id="reservas" className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:px-8 lg:grid-cols-2">
        <article className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-7 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--terracotta)]">Negocio</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">Agenda, servicios, clientes y reportes.</h2>
          <p className="mt-4 leading-7 text-[var(--ink-soft)]">Configura servicios, duracion, precio, seña configurable, profesionales y disponibilidad. Gestiona el dia desde un dashboard operativo.</p>
        </article>
        <article className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-7 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--clinical)]">Reservas publicas</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">Tus clientes reservan sin crear cuenta.</h2>
          <p className="mt-4 leading-7 text-[var(--ink-soft)]">Cada negocio publica su subdominio, por ejemplo minegocio.citadely.com.ar, para que cualquier cliente elija servicio, horario y deje sus datos de contacto.</p>
        </article>
      </section>

      <section id="rubros" className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terracotta)]">Rubros que viven de la agenda</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Un mismo sistema para turnos, cupos y consultas.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[var(--ink-soft)]">
            Cada rubro configura sus servicios, precios, señas y disponibilidad mensual; los clientes solo eligen dia, horario y dejan sus datos.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((item, index) => (
            <article className="group min-h-56 rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm hover:-translate-y-1 hover:border-[var(--line-strong)] hover:bg-[var(--surface-raised)]" key={item.title}>
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full bg-[var(--reception-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--reception)]">
                  {item.tag}
                </span>
                <span className="number-tabular text-sm font-semibold text-[var(--ink-muted)]">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-6 text-xl font-semibold leading-tight tracking-[-0.04em]">{item.title}</h3>
              <p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer id="pagos" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--ink)] p-7 text-white sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f0c676]">Plan mensual</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
            7 dias gratis y luego suscripcion automatica de $15000 ARS por mes.
          </h2>
          <p className="mt-5 max-w-2xl leading-7 text-white/70">
            Mercado Pago se usa para cobrarle a cada negocio el uso de Citadely. Las señas de los clientes se gestionan por alias o CBU/CVU del negocio.
          </p>
        </div>
      </footer>
    </main>
  );
}
