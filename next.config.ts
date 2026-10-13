import type { NextConfig } from "next";

/**
 * El proyecto tiene dos destinos de publicación:
 * - Node (por defecto): la aplicación interna se ejecuta con `next start`, lo que
 *   habilita Server Actions, cookies y sesión.
 * - Estático (`npm run build:static`): genera `out/` para el hosting compartido
 *   con Apache, donde no hay runtime de Node.
 */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export", images: { unoptimized: true } } : {}),
  // El chequeo se ejecuta por separado (`npm run typecheck`); evita un fallo de procesos hijo de este entorno.
  typescript: { ignoreBuildErrors: true },
  experimental: { cpus: 1 },
};

export default nextConfig;
