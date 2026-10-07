/**
 * Convierte un data URL (`data:image/png;base64,...`) en un Blob.
 *
 * No se usa `fetch(dataUrl)`: el navegador rechaza las URLs `data:` en fetch
 * ("Failed to fetch"), y la firma del cliente nunca llegaba al almacenamiento.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;charset=[^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("El contenido capturado no es un data URL válido.");

  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[3]);
  const payload = match[4] ?? "";

  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  }

  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}