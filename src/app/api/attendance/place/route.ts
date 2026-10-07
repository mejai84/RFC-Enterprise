import { NextResponse } from "next/server";

/**
 * Nombre legible de un punto, consultado a OpenStreetMap desde el servidor.
 *
 * Se hace en el servidor y no en el navegador por dos razones: el CSP del sitio
 * solo permite conexiones propias, de modo que el cliente no puede salir a un
 * tercero, y asi queda un unico punto de salida que el equipo puede auditar o
 * bloquear. El punto sigue siendo opcional: si el servicio falla, se responde
 * sin nombre y el registro se guarda igual.
 */

export const dynamic = "force-dynamic";

const CACHE_LIMIT = 200;
const cache = new Map<string, string | undefined>();

function cacheKey(latitude: number, longitude: number): string {
  // Se agrupa por cuatro decimales: cerca de un metro, mas que suficiente.
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lon"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ label: null }, { status: 400 });
  }

  const key = cacheKey(latitude, longitude);
  if (cache.has(key)) {
    return NextResponse.json({ label: cache.get(key) ?? null });
  }

  let label: string | undefined;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}&accept-language=es`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          // Politica de uso de Nominatim: identificar la aplicacion.
          "User-Agent": "RFC-Enterprise/1.0 (registro de jornada)",
        },
      },
    );
    clearTimeout(timer);
    if (response.ok) {
      const data = (await response.json()) as { display_name?: string; name?: string; address?: Record<string, string> };
      const address = data.address ?? {};
      // Un nombre solo ("La Concepcion") no dice nada del frente de trabajo:
      // se completa con la ciudad y el departamento cuando existen.
      const place =
        address.suburb ??
        address.neighbourhood ??
        address.quarter ??
        address.hamlet ??
        address.village ??
        address.city ??
        address.town ??
        data.name;
      const city = [address.city, address.town, address.village].find((part): part is string => Boolean(part && part.trim()));
      const state = address.state?.trim();
      const parts = [place?.trim(), city && city !== place ? city.trim() : undefined, state && state !== city ? state : undefined].filter(
        (part): part is string => Boolean(part),
      );
      const composed = [...new Set(parts)].join(", ");
      const candidate = composed || data.display_name?.split(",").slice(0, 3).join(",").trim();
      if (candidate && candidate.length > 2) label = candidate.slice(0, 160);
    }
  } catch {
    label = undefined;
  }

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value ?? "");
  cache.set(key, label);

  return NextResponse.json({ label: label ?? null });
}