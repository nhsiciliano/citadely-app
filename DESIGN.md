---
name: Citadely
description: Una central de turnos profesional, precisa e intensa que hace visible el pulso de cada jornada.
colors:
  canvas: "#f2f5fa"
  surface: "#ffffff"
  surface-subtle: "#f7f9fc"
  navy: "#071f3d"
  navy-raised: "#0b2b52"
  primary: "#0957d9"
  primary-strong: "#0649bd"
  primary-soft: "#eaf2ff"
  violet: "#6d4bd1"
  violet-soft: "#f0edff"
  success: "#087a55"
  success-soft: "#e7f7f0"
  warning: "#a75900"
  warning-soft: "#fff3df"
  danger: "#c32f3d"
  danger-soft: "#fff0f1"
  danger-line: "#efb7bd"
  ink: "#091a33"
  ink-soft: "#526078"
  ink-muted: "#657086"
  line: "#dce3ed"
  line-strong: "#bcc7d6"
typography:
  display:
    fontFamily: "Funnel Display, Geist, sans-serif"
    fontSize: "clamp(3rem, 5vw, 3.4rem)"
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Funnel Display, Geist, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1
    letterSpacing: "0.12em"
  data:
    fontFamily: "Geist Mono, monospace"
    fontSize: "1.45rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
rounded:
  sm: "0.25rem"
  calendar: "0.3rem"
  md: "0.375rem"
  pill: "999px"
spacing:
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
  "10": "2.5rem"
  "12": "3rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 1rem"
    height: "2.75rem"
  form-control:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 0.875rem"
    height: "3rem"
  status-confirmed:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.pill}"
    padding: "0.2rem 0.55rem"
  status-pending:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    padding: "0.2rem 0.55rem"
  surface-section:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "1.25rem"
---

# Design System: Citadely

## Overview

**Creative North Star: "Pulso de jornada"**

Citadely se comporta como una central de turnos en actividad: profesional, precisa e intensa. La interfaz convierte tiempo, estados, señas y próximas acciones en una trama operativa visible; el cobalto marca lo que requiere decisión, el azul noche sostiene la estructura y las reglas finas mantienen cada dato en su lugar.

La expresión pública y la operación comparten el mismo mundo, pero cambian de énfasis. La landing narra el movimiento de una reserva mediante una línea temporal; el producto prioriza agenda, métricas tabulares, filas accionables y drawers que conservan el contexto. En la reserva pública domina la identidad configurada por cada negocio y Citadely se retira a una firma discreta.

La intensidad nace del contraste, el ritmo y la información, no de efectos ornamentales. Se excluyen el beige, el glassmorphism, los gradientes decorativos, el redondeado excesivo, el hero SaaS con captura flotante y la repetición de tarjetas genéricas intercambiables.

**Key Characteristics:**

- Azul noche estructural y cobalto de acción sobre blancos fríos.
- Tiempo, dinero, cantidades e identificadores en cifras tabulares.
- Reglas finas y superficies mayormente rectas, con radios pequeños solo en controles.
- Estados semánticos intensos que combinan fondo suave y texto de alto contraste.
- Composición responsiva completa: panorama operativo en escritorio y jornada actual en móvil.

## Colors

La paleta combina una base fría y clínica con acentos saturados reservados para acción y estado.

### Primary

- **Cobalto operativo** (`primary`): acción principal, selección, foco, vínculos, horarios y el hilo visual de la jornada.
- **Cobalto firme** (`primary-strong`): estado hover de la acción principal y contraste reforzado.
- **Niebla cobalto** (`primary-soft`): selección tonal, iconografía contenida y estados completados de agenda.

### Secondary

- **Violeta de ausencia** (`violet`): estado “No asistió” y excepciones de agenda.
- **Lavanda de ausencia** (`violet-soft`): fondo tonal de ese estado.

### Tertiary

- **Verde confirmado** (`success`) y **menta confirmada** (`success-soft`): confirmación, disponibilidad y resultados correctos.
- **Ámbar de seña** (`warning`) y **papel ámbar** (`warning-soft`): cobros pendientes e instrucciones de transferencia.
- **Rojo de interrupción** (`danger`), **rosa de interrupción** (`danger-soft`) y **línea de interrupción** (`danger-line`): cancelación, error y acceso pausado.

### Neutral

- **Azul noche de mando** (`navy`) y **azul noche elevado** (`navy-raised`): navegación, cierres de página y paneles estructurales de alto contraste.
- **Tinta principal** (`ink`), **tinta secundaria** (`ink-soft`) y **tinta silenciada** (`ink-muted`): jerarquía de lectura sin recurrir a negro puro.
- **Lienzo frío** (`canvas`), **blanco de superficie** (`surface`) y **blanco frío sutil** (`surface-subtle`): estratos de fondo y áreas de trabajo.
- **Regla fría** (`line`) y **regla fría firme** (`line-strong`): divisores, contornos, estados vacíos y límites interactivos.

**The Cobalt Means Action Rule.** El cobalto identifica acción, selección o foco; no se usa como relleno decorativo sin consecuencia interactiva.

**The Semantic Pair Rule.** Cada estado combina su tinta intensa con su fondo suave correspondiente; el color nunca es el único indicador porque siempre aparece junto a una etiqueta legible.

## Typography

**Display Font:** Funnel Display (con Geist y sans-serif como respaldo)

**Body Font:** Geist (con Arial, Helvetica y sans-serif como respaldo)

**Label/Mono Font:** Geist Mono para datos; Geist semibold para etiquetas

**Character:** Funnel Display aporta una voz compacta y firme a la comunicación y a los momentos editoriales. Geist mantiene la operación sobria y legible; Geist Mono vuelve inmediatamente escaneables horas, precios, métricas, fechas e identificadores.

### Hierarchy

- **Display** (600, `clamp(3rem, 5vw, 3.4rem)`, 0.96): promesa principal de la landing y nombre protagonista del negocio.
- **Headline** (600, 2.25rem en móvil y 3rem desde `sm`, 1): encabezados de grandes secciones persuasivas.
- **Title** (600, 1.5rem, 1.2): títulos de pantalla operativa; usa tracking compacto para sostener densidad.
- **Body** (400, 1rem, 1.75): explicación y contenido continuo; los textos operativos más compactos bajan a 0.875rem con 1.5 de interlínea.
- **Label** (650, 0.75rem, 0.12em, mayúsculas): pasos, filtros y metadatos breves; las etiquetas de formulario conservan caja normal a 0.875rem.
- **Data** (600, 1.45rem, 1, tracking -0.035em): métricas; la misma familia escala entre 0.6875rem y 3rem para horas, IDs y precios.

**The Operational Numerals Rule.** Toda cifra que se compare o cambie durante la jornada usa Geist Mono o, como mínimo, `tabular-nums`.

**The Two-Voice Rule.** Funnel Display habla en momentos editoriales; Geist gobierna controles, navegación y trabajo diario. No se intercambian por conveniencia local.

## Layout

La estructura se apoya en divisiones, no en grupos de tarjetas flotantes. La landing utiliza un contenedor máximo de 1440px y gutters de 20px en móvil, 32px desde `sm` y 48px desde `lg`; la reserva pública se contiene en 1280px. Las secciones de persuasión alternan mitades, bandas y grillas delineadas, mientras el workspace conserva una columna continua para la navegación y un lienzo flexible para la operación.

En escritorio, la barra lateral mide 256px y puede contraerse a 84px. En móvil se transforma en un panel superpuesto de 286px y deja el contenido completo detrás. Los encabezados operativos usan 20px de gutter móvil, 32px desde `sm` y 40px desde `lg`; los bloques de trabajo repiten un ritmo vertical de 24px.

Los puntos de cambio observados son 640px (`sm`), 768px (`md`), 1024px (`lg`) y 1280px (`xl`). La agenda fuerza vista diaria por debajo de 768px; la vista semanal conserva un ancho mínimo de 1020px con desplazamiento horizontal. Los drawers ocupan todo el ancho móvil y se limitan a 420px o 480px desde `sm`; a partir de 1280px, el contenido principal descuenta su ancho para mantener el contexto visible.

**The Rule-Built Grid Rule.** Cuando varios elementos forman una secuencia o conjunto, se construyen como una grilla compartida con divisores, no como una colección de tarjetas independientes.

**The Current-Journey Rule.** En espacios reducidos se priorizan hoy, el próximo turno y la acción inmediata; la amplitud de escritorio se reserva para comparación y panorama.

## Elevation & Depth

El sistema es plano por defecto y usa una combinación controlada de línea y sombra ambiental. La sombra de superficie es casi imperceptible y acompaña contornos; la sombra elevada se reserva para paneles decisivos, autenticación, resumen de reserva y navegación móvil. El drawer usa una sombra lateral direccional para expresar desplazamiento sin vidrio ni desenfoque.

### Shadow Vocabulary

- **Superficie ambiental** (`0 2px 5px rgba(8, 31, 63, 0.045), 0 12px 30px rgba(8, 31, 63, 0.035)`): paneles de agenda, métricas y secciones de trabajo.
- **Elevación operativa** (`0 8px 28px rgba(8, 31, 63, 0.14)`): paneles con prioridad, navegación móvil y contenedores de autenticación.
- **Borde activo cobalto** (`0 5px 16px rgba(9, 87, 217, 0.18)`): refuerzo exclusivo del botón primario.
- **Drawer lateral** (`-18px 0 48px rgba(8, 31, 63, 0.16)`): separación direccional del panel de detalle.

**The Line Before Shadow Rule.** Una superficie se delimita primero con una regla fría; la sombra solo aclara jerarquía o superposición.

**The No Glass Rule.** No se usan blur, transparencia lechosa ni glassmorphism. Los overlays oscuros existen solo para proteger legibilidad sobre imágenes o marcar modalidad.

## Shapes

La forma base es recta y administrativa. Las grandes superficies, tablas, bandas y módulos de métricas no redondean sus esquinas; los controles usan un radio compacto de 6px (`rounded.md`). El calendario afina a 4.8px y los segmentos internos a 4px. La cápsula de 999px queda restringida a estados, contadores, horas y pequeños indicadores circulares.

Los bordes son continuos de 1px; los vacíos y cargas de archivos usan línea discontinua. Las imágenes y logotipos pueden recortarse con el mismo radio compacto, sin convertir el sistema en una colección de pastillas.

**The Small-Corner Rule.** Si un elemento no necesita comunicar interacción, selección o identidad compacta, permanece recto.

**The Pill Is Metadata Rule.** La cápsula pertenece a estados y metadatos breves; nunca encierra paneles, campos extensos ni acciones principales.

## Components

### Buttons

- **Shape:** rectángulo compacto con esquinas de 6px, altura mínima de 44px y gap interno de 8px.
- **Primary:** cobalto operativo con texto blanco, borde del mismo color, peso 650 y padding horizontal de 16px; puede incluir un icono de 16–18px.
- **Hover / Focus:** el hover cambia a cobalto firme y eleva 1px; el foco visible usa un outline cobalto de 2px separado 3px. Las transiciones de color, sombra y transformación duran 160ms con `ease-out`.
- **Secondary / Ghost / Tertiary:** la secundaria permanece blanca con regla fría y gana fondo frío sutil en hover; los icon buttons comparten una caja de 44px; los enlaces de texto usan cobalto sin fondo.

### Chips

- **Style:** los estados usan pares semánticos suaves/intensos, altura mínima de 27.2px, padding de 3.2px × 8.8px y peso 700. Los horarios usan niebla cobalto, Geist Mono y una altura mínima de 32px.
- **State:** seleccionado y no seleccionado siempre se distinguen por relleno, contorno y texto; la etiqueta verbal permanece visible.

### Cards / Containers

- **Corner Style:** grandes paneles rectos; solo contenidos seleccionables o resúmenes internos adoptan 6px.
- **Background:** blanco de superficie sobre lienzo frío; el blanco frío sutil identifica subregiones, filtros y información secundaria.
- **Shadow Strategy:** superficie ambiental en reposo, elevación operativa solo para jerarquía fuerte.
- **Border:** regla fría de 1px; las divisiones internas comparten el mismo sistema de bordes.
- **Internal Padding:** 20px como base, 24px en superficies amplias y hasta 40px en bloques persuasivos.

### Inputs / Fields

- **Style:** campo blanco de 48px de altura mínima, borde de 1px, radio de 6px, padding horizontal de 14px y texto Geist de 16px/500.
- **Focus:** borde cobalto más halo de 3px al 10%; el outline global mantiene la navegación por teclado visible.
- **Error / Disabled:** error con rosa y rojo semánticos; controles deshabilitados bajan a 55% de opacidad y conservan su estructura.

### Navigation

La navegación del workspace vive sobre azul noche. Cada destino mide al menos 44px, usa Geist de 14px/500 e iconos lineales de 19px. El activo se llena de cobalto; el reposo usa blanco atenuado y el hover aumenta contraste con un velo blanco mínimo. En móvil la barra se desplaza desde la izquierda sobre un overlay oscuro; en escritorio puede reducirse a iconos sin perder `title` ni nombre accesible.

### Agenda Calendar

La agenda es el componente firma del modo Operate: una matriz horaria de reglas continuas, horas en mono y eventos posicionados por duración real. Cada evento usa el par semántico de su estado, un contorno relacionado y una esquina de 4.8px; al abrirse, el detalle aparece en un drawer sin abandonar la referencia temporal.

### Journey Pulse

El próximo turno y la demostración de la landing comparten una línea cobalto, nodos circulares y horas tabulares. El patrón expresa avance real —reserva, seña, confirmación, horario— y nunca funciona como adorno abstracto.

### Drawer

El drawer es un panel modal blanco de ancho completo en móvil y 420px/480px en pantallas mayores. Conserva encabezado fijo, cuerpo desplazable y acciones persistentes al pie; entra 32px desde la derecha en 220ms con una curva intensa `cubic-bezier(.2,.8,.2,1)`. El backdrop aparece en 180ms y `prefers-reduced-motion` reduce ambas animaciones prácticamente a cero.

### Public Booking

La página pública hereda estructura, tipografía y tokens neutros de Citadely, pero reemplaza el cobalto de selección por `--booking-brand`. Servicio, día y horario usan contorno más ring o relleno para selección; el resumen final se eleva y permanece sticky en escritorio. El logo y la portada del negocio dominan, mientras Citadely firma en escala reducida al final.

## Do's and Don'ts

### Do:

- **Do** estructurar secuencias, métricas y colecciones con reglas compartidas y alineación tabular.
- **Do** reservar el cobalto para acción, selección, foco y continuidad temporal.
- **Do** usar Geist Mono para horas, precios, porcentajes, cantidades, fechas compactas e identificadores.
- **Do** mantener cada estado acompañado por una etiqueta y su par de tinta/fondo semántico.
- **Do** ceder el color protagonista a la marca del negocio en la reserva pública mediante `--booking-brand`.
- **Do** sostener foco visible, navegación por teclado y reducción de movimiento en todos los componentes nuevos.

### Don't:

- **Don't** volver al beige ni calentar la base fría con tonos crema genéricos.
- **Don't** usar glassmorphism, blur o gradientes decorativos; una superposición sobre fotografía solo se justifica por legibilidad.
- **Don't** convertir cada dato en una tarjeta redondeada e intercambiable ni reconstruir el hero como una captura SaaS flotante.
- **Don't** redondear grandes superficies: las cápsulas son para estados y metadatos, y los controles se limitan a radios pequeños.
- **Don't** introducir sombras como decoración; primero resolvé jerarquía con fondo, regla, espaciado y contraste.
- **Don't** dejar que la marca Citadely compita con la identidad del negocio en su página pública.
