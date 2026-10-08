import type { NextConfig } from "next";

// Keep the production build on webpack, matching the verified Vercel command.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
    };
    return config;
  },
};

export default nextConfig;
