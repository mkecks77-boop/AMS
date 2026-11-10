import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Datei-Uploads (SDB, Zertifikate, Fotos) bis 15 MB plus Formularanteil
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
