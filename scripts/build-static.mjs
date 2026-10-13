import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Genera el export estático (`out/`) para el hosting compartido con Apache.
 * El build normal (`npm run build`) produce la aplicación de Node.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(nextBin)) {
  console.error("No se encontró el binario de Next. Ejecuta `npm install` primero.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NEXT_STATIC_EXPORT: "true" },
});

process.exit(result.status ?? 1);
