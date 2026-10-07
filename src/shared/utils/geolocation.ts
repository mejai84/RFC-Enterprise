/**
 * Ubicación declarada voluntariamente por el empleado.
 *
 * Este módulo NO rastrea a nadie. No hay vigilancia en segundo plano: la lectura
 * ocurre únicamente cuando la persona pulsa el botón de ubicación, se hace una
 * sola vez y el resultado se entrega al formulario. Si nadie pulsa el botón, el
 * sistema nunca pide permiso ni consulta nada.
 */

export type LocationErrorKind =
  | "unsupported"
  | "permission-denied"
  | "gps-off"
  | "unavailable"
  | "timeout";

export type LocationReadResult =
  | { ok: true; latitude: number; longitude: number; accuracyMeters: number | null }
  | { ok: false; kind: LocationErrorKind; message: string };

export type DeclaredLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  /** Nombre del lugar, si se pudo resolver. Nunca es obligatorio. */
  label?: string;
};

const MESSAGES: Record<LocationErrorKind, string> = {
  unsupported: "Este equipo no permite compartir la ubicación. Escribe el sitio con tus palabras.",
  "permission-denied":
    "No compartiste tu ubicación. Puedes registrar tu jornada igual, escribiendo el sitio con tus palabras.",
  "gps-off":
    "Tu ubicación está desactivada o el GPS está apagado. Actívalo en los ajustes del teléfono si quieres usarlo; no es obligatorio.",
  unavailable: "No fue posible obtener la ubicación en este momento. Intenta de nuevo o escribe el sitio.",
  timeout: "La ubicación tardó demasiado en llegar. Intenta de nuevo junto a la ventana o escribe el sitio.",
};

function classify(error: GeolocationPositionError): LocationErrorKind {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "permission-denied";
    case error.POSITION_UNAVAILABLE:
      return "gps-off";
    case error.TIMEOUT:
      return "timeout";
    default:
      return "unavailable";
  }
}

/** Lee la ubicación una sola vez, previa acción explícita del usuario. */
export function readLocationOnce(timeoutMs = 15000): Promise<LocationReadResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, kind: "unsupported", message: MESSAGES.unsupported });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters:
            typeof position.coords.accuracy === "number" && Number.isFinite(position.coords.accuracy)
              ? Math.round(position.coords.accuracy)
              : null,
        }),
      (error) => {
        const kind = classify(error);
        resolve({ ok: false, kind, message: MESSAGES[kind] });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/**
 * Nombre legible del punto, resuelto por el servidor de RFC Enterprise.
 *
 * Es una ayuda opcional: si la ruta no responde, la ubicación se conserva igual y
 * el formulario solo muestra el punto con su aproximación. Se pide únicamente
 * cuando la persona ya aceptó compartir su ubicación.
 */
export async function describePlace(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(
      `/api/attendance/place?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    clearTimeout(timer);
    if (!response.ok) return undefined;
    const data = (await response.json()) as { label?: string | null };
    return data.label ?? undefined;
  } catch {
    return undefined;
  }
}

/** Enlace para ver el punto en la app de mapas del teléfono. */
export function mapsLink(latitude: number, longitude: number, isApple: boolean): string {
  const lat = encodeURIComponent(String(latitude));
  const lon = encodeURIComponent(String(longitude));
  return isApple
    ? `https://maps.apple.com/?ll=${lat},${lon}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * Enlace de búsqueda por texto, para cuando todavía no hay punto capturado.
 * En iPhone y Android el esquema `https` lo resuelve la app instalada.
 */
export function mapsSearchLink(query: string, isApple: boolean): string {
  const text = query.trim();
  if (!text) return isApple ? "https://maps.apple.com/" : "https://www.google.com/maps";
  const encoded = encodeURIComponent(text);
  return isApple ? `https://maps.apple.com/?q=${encoded}` : `https://maps.google.com/?q=${encoded}`;
}

export function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const agent = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(agent) || (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
}