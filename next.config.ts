import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dd.dexscreener.com",
      },
      {
        protocol: "https",
        hostname: "**.dexscreener.com",
      },
      {
        protocol: "https",
        hostname: "gmgn.ai",
      },
      {
        protocol: "https",
        hostname: "**.gmgn.ai",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
      {
        protocol: "https",
        hostname: "arweave.net",
      },
      {
        protocol: "https",
        hostname: "cf-ipfs.com",
      },
      {
        protocol: "https",
        hostname: "**.pump.fun",
      },
      {
        protocol: "https",
        hostname: "**.helius-rpc.com",
      },
      {
        protocol: "https",
        hostname: "cdn.helius-rpc.com",
      },
    ],
  },
};

export default nextConfig;
