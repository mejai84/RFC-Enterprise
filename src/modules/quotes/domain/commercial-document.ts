/* ─────────────────────────────────────────────────────────────
 * Módulo de Cotizaciones – Expediente comercial (dominio)
 * src/modules/quotes/domain/commercial-document.ts
 *
 * Soportes que respaldan la relación comercial con el cliente.
 * Deliberadamente separado de `technical-document.ts`: el
 * expediente no reemplaza el procedimiento de trabajo ni la
 * matriz de riesgos, ni participa en la conversión a obra.
 * ───────────────────────────────────────────────────────────── */

export const commercialDocumentTypes = [
  "request_original",
  "drawings",
  "email_support",
  "service_order",
  "client_approval",
] as const;

export type CommercialDocumentType = (typeof commercialDocumentTypes)[number];

export const commercialDocumentLabels: Record<CommercialDocumentType, string> = {
  request_original: "Solicitud original",
  drawings: "Planos",
  email_support: "Correos y soportes",
  service_order: "Orden de servicio",
  client_approval: "Aprobación del cliente",
};

/** Texto de estado vacío por tipo: qué significa que falte ese soporte. */
export const commercialDocumentEmptyHints: Record<CommercialDocumentType, string> = {
  request_original: "Aún no se registra el correo, formulario o llamada de entrada del cliente.",
  drawings: "Sin planos adjuntos ni enlace a la carpeta de planos.",
  email_support: "Sin correos ni soportes que respalden la solicitud.",
  service_order: "La orden de servicio se emite cuando el cliente aprueba la propuesta.",
  client_approval: "Sin aprobación formal del cliente; se adjunta al confirmar el trabajo.",
};

/** Descripción del tipo, para el formulario de carga. */
export const commercialDocumentHints: Record<CommercialDocumentType, string> = {
  request_original: "Correo, formulario o mensaje original que originó la cotización.",
  drawings: "Planos de la obra, render o anexos enviados por el cliente.",
  email_support: "Correos posteriores, aclaraciones y soportes del proceso.",
  service_order: "Orden de servicio emitida a nombre del cliente.",
  client_approval: "Aprobación escrita, acta o correo de conformidad del cliente.",
};

export type QuoteCommercialDocument = {
  id: string;
  quoteId: string;
  documentType: CommercialDocumentType;
  /** Nombre del soporte, legible para una persona. */
  title: string;
  /** Fecha del documento en formato YYYY-MM-DD; puede no estar. */
  documentDate?: string;
  /** Responsable interno que lo aporta o custodia. */
  responsible: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  /** Ruta privada en Storage; solo existe si el soporte es un archivo. */
  storagePath?: string;
  /** Enlace externo; solo existe si el soporte no es un archivo. */
  externalUrl?: string;
  notes?: string;
  createdAt: string;
  /** URL firmada de corta duración, solo para ver o descargar. */
  signedUrl?: string;
};

/** Formulario de alta de un soporte del expediente. */
export type CommercialDocumentInput = {
  quoteId: string;
  documentType: CommercialDocumentType;
  title: string;
  documentDate?: string;
  responsible: string;
  notes?: string;
  /** Exactamente uno de los dos: archivo o enlace externo. */
  file?: File;
  externalUrl?: string;
};

export const commercialDocumentMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** Tamaño máximo del archivo: 25 MB, alineado con el constraint de base de datos. */
export const commercialDocumentMaxBytes = 25 * 1024 * 1024;

/** Valida en el navegador lo mismo que valida la RPC, para fallar rápido. */
export function validateCommercialDocumentInput(
  input: CommercialDocumentInput,
): string | null {
  const title = input.title.trim();
  if (title.length < 3 || title.length > 180) {
    return "El nombre del soporte debe tener entre 3 y 180 caracteres.";
  }
  if (input.responsible.trim().length < 3) {
    return "Indica quién responde por este soporte (mínimo 3 caracteres).";
  }
  const hasFile = Boolean(input.file);
  const hasUrl = Boolean(input.externalUrl?.trim());
  if (hasFile === hasUrl) {
    return "Adjunta un archivo o registra un enlace externo, no ambos ni ninguno.";
  }
  if (hasFile && input.file) {
    if (!commercialDocumentMimeTypes.includes(input.file.type as (typeof commercialDocumentMimeTypes)[number])) {
      return "Formato no permitido. Usa PDF, Word, Excel o imagen (PNG, JPG, WEBP).";
    }
    if (!input.file.size || input.file.size > commercialDocumentMaxBytes) {
      return "El archivo debe pesar máximo 25 MB.";
    }
  }
  if (hasUrl && !/^https?:\/\//i.test(input.externalUrl!.trim())) {
    return "El enlace debe comenzar con http:// o https://.";
  }
  return null;
}

/** Agrupa los soportes por tipo, en el orden en que se recorren en pantalla. */
export function groupCommercialDocuments(
  documents: QuoteCommercialDocument[],
): Record<CommercialDocumentType, QuoteCommercialDocument[]> {
  const grouped = Object.fromEntries(
    commercialDocumentTypes.map((type) => [type, [] as QuoteCommercialDocument[]]),
  ) as Record<CommercialDocumentType, QuoteCommercialDocument[]>;
  for (const document of documents) {
    grouped[document.documentType]?.push(document);
  }
  for (const type of commercialDocumentTypes) {
    grouped[type].sort((a, b) => (b.documentDate ?? b.createdAt).localeCompare(a.documentDate ?? a.createdAt));
  }
  return grouped;
}

/** Tamaño de archivo legible, para la ficha del soporte. */
export function formatCommercialDocumentSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}