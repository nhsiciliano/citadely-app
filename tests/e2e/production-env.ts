// Importar antes que los módulos de la app: lib/env lee el entorno al cargarse.
// Sin esto, los tests de subdominios corren como "no producción" y no ejercitan esas reglas.
process.env.VERCEL_ENV = "production";
process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
