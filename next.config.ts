import type { NextConfig } from "next";

// Origen del proyecto Vercel de la landing Astro (apps/landing), sin barra final. Se lee en build:
// cambiarlo exige un nuevo deploy. Sin definir, / muestra el placeholder de app/page.tsx.
const landingOrigin = process.env.LANDING_ORIGIN?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // app/api/admin/blog-images/route.ts converts covers with sharp, and sharp loads its libvips
  // binary at runtime from a package that file tracing does not detect. The Linux x64 companion
  // package must be included in that route's function bundle or it fails on Vercel.
  // Evaluated and not enabled (6.6): reactCompiler (needs babel-plugin-react-compiler and changes
  // memoization across the tree without a measured gain) and typedRoutes (8 dynamic href strings
  // would need typed props first).
  outputFileTracingIncludes: {
    "/api/admin/blog-images": [
      "node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  // Next logs Server Function arguments in dev; the auth actions receive passwords and reset codes.
  logging: { serverFunctions: false },
  images: {
    // Portadas y fotos del negocio se sirven desde el storage de InsForge (parent y branches).
    remotePatterns: [
      { protocol: "https", hostname: "*.us-east.insforge.app", pathname: "/api/storage/**" },
    ],
  },
  async rewrites() {
    // beforeFiles corre después de proxy.ts, que ya reescribió / → /b/<slug> en subdominios de negocio.
    // Astro emite politica-de-privacidad/index.html, por eso los destinos llevan barra final. Su
    // directorio de assets se renombra a landing-assets (L2); el matcher del proxy excluye paths con
    // punto, así que ese rewrite tiene que vivir acá.
    const beforeFiles = landingOrigin
      ? [
          { source: "/", destination: `${landingOrigin}/` },
          { source: "/politica-de-privacidad", destination: `${landingOrigin}/politica-de-privacidad/` },
          { source: "/condiciones-del-servicio", destination: `${landingOrigin}/condiciones-del-servicio/` },
          { source: "/landing-assets/:path*", destination: `${landingOrigin}/landing-assets/:path*` },
        ]
      : [];
    return {
      beforeFiles,
      afterFiles: [{ source: "/admin-panel/api/:path*", destination: "/api/admin/:path*" }],
      fallback: [],
    };
  },
};

export default nextConfig;
