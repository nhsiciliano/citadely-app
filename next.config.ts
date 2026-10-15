import type { NextConfig } from "next";

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
  images: {
    // Portadas y fotos del negocio se sirven desde el storage de InsForge (parent y branches).
    remotePatterns: [
      { protocol: "https", hostname: "*.us-east.insforge.app", pathname: "/api/storage/**" },
    ],
  },
  async rewrites() {
    return [{ source: "/admin-panel/api/:path*", destination: "/api/admin/:path*" }];
  },
};

export default nextConfig;
