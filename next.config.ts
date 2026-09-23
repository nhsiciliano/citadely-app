import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/admin-panel/api/:path*", destination: "/api/admin/:path*" }];
  },
};

export default nextConfig;
