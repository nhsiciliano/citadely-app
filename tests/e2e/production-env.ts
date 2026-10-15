// Importar antes que los módulos de la app: lib/env lee el entorno al cargarse.
// Solo VERCEL_ENV (servidor): cubre el caso en que Vercel no expone NEXT_PUBLIC_VERCEL_ENV.
process.env.VERCEL_ENV = "production";
