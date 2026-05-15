import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ["@sm-visitor/hooks", "@sm-visitor/shared-types", "@sm-visitor/ui"],
};

export default nextConfig;
