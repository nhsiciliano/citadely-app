import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp's Linux binary needs this companion libvips bundle in the Vercel function trace.
  outputFileTracingIncludes: {
    "/api/admin/blog-images": [
      "node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  async rewrites() {
    return [{ source: "/admin-panel/api/:path*", destination: "/api/admin/:path*" }];
  },
};

export default nextConfig;
