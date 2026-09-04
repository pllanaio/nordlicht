import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel packages Next.js functions itself. Docker uses the standalone server.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
