import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type {
  CommercialDocumentInput,
  CommercialDocumentType,
  QuoteCommercialDocument,
} from "../domain/commercial-document";

/** Bucket privado del expediente comercial. Nunca se sirve público. */
const bucket = "quote-commercial-documents";

/** Vigencia corta de la URL firmada: alcanza para ver o descargar. */
const signedUrlTtlSeconds = 300;

type CommercialDocumentRow = {
  id: string;
  quote_id: string;
  document_type: CommercialDocumentType;
  title: string;
  document_date: string | null;
  responsible: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: string | number | null;
  storage_path: string | null;
  external_url: string | null;
  notes: string | null;
  created_at: string;
  upload_pending: boolean;
};

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

function toQuoteCommercialDocument(
  row: CommercialDocumentRow,
  signedUrl?: string,
): QuoteCommercialDocument {
  return {
    id: row.id,
    quoteId: row.quote_id,
    documentType: row.document_type,
    title: row.title,
    documentDate: row.document_date ?? undefined,
    responsible: row.responsible,
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes == null ? undefined : Number(row.size_bytes),
    storagePath: row.storage_path ?? undefined,
    externalUrl: row.external_url ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    signedUrl,
  };
}

/**
 * Lista el expediente comercial de una cotización.
 * Cada archivo privado se resuelve con una URL firmada de corta duración: el
 * bucket no es público, así que sin esta firma el enlace no serviría.
 */
export async function loadQuoteCommercialDocuments(
  quoteId: string,
): Promise<QuoteCommercialDocument[]> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { data, error } = await supabase
    .from("quote_commercial_documents")
    .select(
      "id, quote_id, document_type, title, document_date, responsible, file_name, mime_type, size_bytes, storage_path, external_url, notes, created_at, upload_pending",
    )
    .eq("quote_id", quoteId)
    .eq("upload_pending", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (raw: CommercialDocumentRow) => {
      const row = raw;
      if (!row.storage_path) return toQuoteCommercialDocument(row);
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(row.storage_path, signedUrlTtlSeconds);
      return toQuoteCommercialDocument(row, signed?.signedUrl);
    }),
  );
}

/**
 * Registra un soporte del expediente.
 *
 * El alta se hace en dos pasos porque el bucket es privado: primero la RPC deja
 * creado el registro y devuelve la ruta exacta, después el navegador sube el
 * archivo a esa ruta y se confirma el registro. Si la subida falla, el registro
 * se borra para no dejar un soporte vacío en la ficha.
 */
export async function registerQuoteCommercialDocument(
  input: CommercialDocumentInput,
): Promise<QuoteCommercialDocument> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");

  const externalUrl = input.externalUrl?.trim() || null;
  const { data: prepared, error: prepareError } = await supabase.rpc(
    "register_quote_commercial_document",
    {
      p_quote_id: input.quoteId,
      p_document_type: input.documentType,
      p_title: input.title.trim(),
      p_document_date: input.documentDate || null,
      p_responsible: input.responsible.trim(),
      p_external_url: externalUrl,
      p_file_name: input.file?.name ?? null,
      p_mime_type: input.file?.type ?? null,
      p_size_bytes: input.file?.size ?? null,
      p_notes: input.notes?.trim() || null,
    },
  );

  if (prepareError || !prepared) {
    throw prepareError ?? new Error("No fue posible registrar el soporte.");
  }

  const row = prepared as CommercialDocumentRow;
  if (!row.storage_path || !input.file) {
    return toQuoteCommercialDocument(row);
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(row.storage_path, input.file, { contentType: input.file.type, upsert: false });

  if (uploadError) {
    await supabase.rpc("delete_quote_commercial_document", { p_document_id: row.id });
    throw new Error(
      "No fue posible subir el archivo al expediente. Revisa tu conexión e inténtalo de nuevo.",
    );
  }

  const { error: finalizeError } = await supabase.rpc("finalize_quote_commercial_document", {
    p_document_id: row.id,
  });
  if (finalizeError) {
    await supabase.rpc("delete_quote_commercial_document", { p_document_id: row.id });
    throw finalizeError;
  }

  return toQuoteCommercialDocument({ ...row, upload_pending: false });
}

/** Elimina un soporte del expediente y su archivo asociado. */
export async function deleteQuoteCommercialDocument(documentId: string): Promise<void> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("delete_quote_commercial_document", {
    p_document_id: documentId,
  });
  if (error) throw error;
}