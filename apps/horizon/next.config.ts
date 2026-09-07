import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@sm-visitor/hooks", "@sm-visitor/shared-types", "@sm-visitor/ui"],
  images: {
    // Visitor photos are served from Cloudinary. Nothing else is remote.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Each upload gets a fresh public_id, so a URL's bytes never change.
    // Caching them for a month means one fetch from Cloudinary serves every
    // resident who opens the page instead of one per device.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // The app only ever draws avatars and modal previews - trimming the size
    // ladder stops Next from generating widths nothing on screen uses.
    deviceSizes: [640, 828, 1080],
    imageSizes: [48, 64, 96, 128, 192, 256, 384],
  },
};

export default nextConfig;
