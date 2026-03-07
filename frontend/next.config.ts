import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicitly set the Turbopack workspace root to this directory so Next.js
  // doesn't pick up a stray package.json/package-lock.json in a parent directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
