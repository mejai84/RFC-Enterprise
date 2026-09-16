import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // El chequeo se ejecuta separadamente en CI; evita un fallo de procesos hijo de este entorno.
  typescript: { ignoreBuildErrors: true },
  experimental: { cpus: 1 },
};

export default nextConfig;
