import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.sreality.cz",
      },
      {
        protocol: "https",
        hostname: "**.bezrealitky.cz",
      },
      {
        protocol: "https",
        hostname: "**.idnes.cz",
      },
      {
        protocol: "https",
        hostname: "**.reality.cz",
      },
      {
        protocol: "https",
        hostname: "realingo.cz",
      },
      {
        protocol: "https",
        hostname: "**.realingo.cz",
      },
      {
        protocol: "https",
        hostname: "**.ulovdomov.cz",
      },
      {
        protocol: "https",
        hostname: "**.sdn.cz",
      },
      {
        protocol: "https",
        hostname: "**.1gr.cz",
      },
      {
        protocol: "https",
        hostname: "**.ceskereality.cz",
      },
      {
        protocol: "https",
        hostname: "bazos.cz",
      },
      {
        protocol: "https",
        hostname: "**.bazos.cz",
      },
    ],
  },
};

export default nextConfig;
