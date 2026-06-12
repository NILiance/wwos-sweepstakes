import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Image uploads (hero/product photos) exceed the 1 MB default
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
