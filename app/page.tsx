import { LogoMark, PrimaryLink, SecondaryLink } from "@/components/ui";

const metrics = [
  ["Turnos del dia", "24", "vistos por profesional"],
  ["Recordatorios", "Email", "automatizados con Resend"],
  ["Plan", "7 dias gratis", "$15000/mes"],
];

const segments = ["Barberias", "Consultorios", "Spas", "Estetica", "Bienestar"];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--agenda-paper)]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        <LogoMark />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--ink-soft)] md:flex">
          <a className="hover:text-[var(--ink)]" href="#producto">Producto</a>
          <a className="hover:text-[var(--ink)]" href="#reservas">Reservas</a>
          <a className="hover:text-[var(--ink)]" href="#pagos">Pagos</a>
        </nav>
        <div className="flex items-center gap-3">
          <SecondaryLink href="/login">Ingresar</SecondaryLink>
          <div className="hidden sm:block">
            <PrimaryLink href="/registro">Crear cuenta</PrimaryLink>
          </div>
        </div>
      </header>

      <section className="agenda-grid mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
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
            Gestiona citas como una recepcion que nunca se desordena.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">
            Citadely centraliza agenda, clientes, servicios, recordatorios y señas por transferencia para negocios de servicios. Una pagina publica para reservar, un panel privado para operar el dia.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <PrimaryLink href="/registro">Empezar gratis</PrimaryLink>
            <SecondaryLink href="/login">Ya tengo cuenta</SecondaryLink>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-6">
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-raised)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--terracotta)]">
                  Agenda de hoy
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Barberia Norte</h2>
              </div>
              <span className="rounded-full bg-[var(--reception-soft)] px-3 py-2 text-xs font-semibold text-[var(--reception)]">
                78% ocupada
              </span>
            </div>

            <div className="mt-8 grid gap-4">
              {[
                ["09:00", "Corte clasico", "Mateo", "Confirmada"],
                ["10:30", "Barba + perfilado", "Lucia", "Seña paga"],
                ["12:00", "Color", "Ana", "Recordatorio enviado"],
                ["15:00", "Hueco disponible", "", "Publico"],
              ].map(([time, service, client, state]) => (
                <div className="grid grid-cols-[58px_1fr] gap-4" key={`${time}-${service}`}>
                  <span className="number-tabular pt-3 text-sm font-semibold text-[var(--ink-muted)]">{time}</span>
                  <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
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
