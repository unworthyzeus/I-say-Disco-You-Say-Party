import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},
  // Output standalone for Vercel
  output: "standalone",
};

export default nextConfig;
