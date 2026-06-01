import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app — the monorepo parent has its own
  // lockfile, which Next would otherwise infer as the root.
  turbopack: { root: __dirname },
};

export default nextConfig;
