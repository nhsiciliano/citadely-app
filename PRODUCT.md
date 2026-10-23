# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

El usuario principal es la persona responsable de la operación de un negocio de servicios. Organiza la jornada, controla turnos, señas, clientes y servicios, y publica una experiencia de reserva para sus clientes. Citadely debe funcionar para consultorios clínicos y odontológicos, oficinas gubernamentales, estudios contables, gimnasios, escuelas de conducción, alquiler de canchas, centros de estética y otros negocios que trabajan con turnos.

## Product Purpose

Citadely centraliza la administración precisa de turnos de un negocio. Su objetivo es que la persona responsable pueda entender qué sucede hoy, organizar la agenda, gestionar servicios y clientes, controlar señas y ofrecer una página pública de reservas sin cambiar de sistema.

## Positioning

Una central de turnos que conecta la operación diaria del negocio con la reserva pública de sus clientes en un mismo flujo: servicio, disponibilidad, reserva, seña y seguimiento de estado.

## Operating Context

El producto se usa principalmente durante la jornada laboral, con consultas frecuentes y decisiones rápidas. En escritorio se necesita una vista amplia de la agenda y del estado del negocio; en móvil, acceso completo con prioridad en la jornada actual y la agenda diaria. La interfaz y el contenido se presentan en español profesional con voseo argentino.

## Capabilities and Constraints

- Mantener autenticación, registro, recuperación, verificación y onboarding existentes.
- Mantener las operaciones actuales para negocios, servicios, disponibilidad, clientes, turnos, estados, señas, marca pública, transferencia, WhatsApp y aportes voluntarios.
- Mantener el flujo de reserva pública servicio → fecha/hora → datos → confirmación.
- Mantener consultas, RPC, rutas API, tablas, reglas de InsForge y contratos persistidos sin migraciones para esta etapa.
- No incorporar empleados, permisos, horarios laborales, ausencias, notas ni recordatorios nuevos, aunque exista soporte parcial en el esquema.
- No agregar edición de clientes, historial ni capacidades de backend no disponibles actualmente.
- Mantener compatibilidad con `/negocio` y traducir los hashes históricos `#agenda`, `#servicios` y `#clientes` a rutas nuevas.
- Implementar tema claro, optimizado primero para escritorio y completamente funcional en móvil.
- No desplegar ni modificar producción sin aprobación de las capturas finales.

## Brand Commitments

- Nombre del producto: Citadely.
- Voz: profesional, clara, directa y precisa, con voseo argentino.
- Concepto confirmado: “Central de turnos”.
- La identidad debe sentirse profesional y más intensa que la actual.
- La marca de cada negocio domina su página de reserva; Citadely aparece de forma discreta.
- El sistema visual debe evitar el beige actual, glassmorphism, gradientes decorativos, redondeado excesivo y repetición de tarjetas genéricas.

## Evidence on Hand

- Implementación funcional existente en este repositorio, incluida la cobertura E2E del flujo del negocio y de reserva pública.
- Referencia de landing proporcionada por el usuario: `/Users/nhsiciliano/Desktop/Captura de pantalla 2026-09-04 a la(s) 2.07.43 p. m..png`.
- Referencia de dashboard proporcionada por el usuario: `/Users/nhsiciliano/Desktop/Captura de pantalla 2026-09-04 a la(s) 2.10.09 p. m..png`.
- No hay testimonios, empresas, resultados comerciales ni otras pruebas externas aprobadas; no deben inventarse.
- Citadely es gratuito; no hay precios ni período de prueba. Los aportes son voluntarios y no condicionan funciones.

## Product Principles

- Dar control operativo: priorizar estado, tiempo, próxima acción y consecuencias.
- Mostrar el producto funcionando: demostrar flujos reales antes que hacer afirmaciones genéricas.
- Preservar la verdad funcional: una mejora visual no debe prometer ni introducir capacidades inexistentes.
- Reducir fricción sin ocultar precisión: las acciones frecuentes deben ser rápidas y sus estados, inequívocos.
- Ceder protagonismo a cada negocio en la experiencia pública de reserva.

## Accessibility & Inclusion

La experiencia debe cumplir WCAG 2.2 nivel AA, admitir navegación completa por teclado, foco visible, labels asociados, contraste suficiente y reducción de movimiento mediante `prefers-reduced-motion`.
