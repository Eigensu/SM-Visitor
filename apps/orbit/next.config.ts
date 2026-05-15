import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@sm-visitor/hooks", "@sm-visitor/shared-types", "@sm-visitor/ui"],
};

export default nextConfig;
