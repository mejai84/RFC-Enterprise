import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { QuoteTechnicalDocument, TechnicalDocumentStatus, TechnicalDocumentType } from "../domain/technical-document";

const bucket = "quote-technical-documents";
const allowedMimeTypes = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

export async function loadQuoteTechnicalDocuments(quoteId: string): Promise<QuoteTechnicalDocument[]> {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("quote_technical_documents").select("id, document_type, version, title, file_name, mime_type, size_bytes, status, review_notes, created_at, reviewed_at, storage_path").eq("quote_id", quoteId).order("document_type").order("version", { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map(async (row) => {
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(row.storage_path, 300);
    return { id: row.id, documentType: row.document_type as TechnicalDocumentType, version: row.version, title: row.title, fileName: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes), status: row.status as TechnicalDocumentStatus, reviewNotes: row.review_notes ?? undefined, createdAt: row.created_at, reviewedAt: row.reviewed_at ?? undefined, signedUrl: signed?.signedUrl };
  }));
}

export async function uploadQuoteTechnicalDocument(quoteId: string, documentType: TechnicalDocumentType, title: string, file: File) {
  if (!allowedMimeTypes.has(file.type)) throw new Error("Formato no permitido. Usa PDF, DOC o DOCX.");
  if (!file.size || file.size > 15 * 1024 * 1024) throw new Error("El archivo debe pesar máximo 15 MB.");
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data: prepared, error: prepareError } = await supabase.rpc("prepare_quote_technical_document", { p_quote_id: quoteId, p_document_type: documentType, p_title: title.trim(), p_file_name: file.name, p_mime_type: file.type, p_size_bytes: file.size });
  if (prepareError || !prepared) throw prepareError ?? new Error("No fue posible preparar el documento.");
  const { error: uploadError } = await supabase.storage.from(bucket).upload(prepared.storage_path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
}

export async function reviewQuoteTechnicalDocuments(quoteId: string, action: "sent" | "changes_requested" | "approved", notes = "") {
  const supabase = client();
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("review_quote_technical_documents", { p_quote_id: quoteId, p_action: action, p_notes: notes.trim() || null });
  if (error) throw error;
  return data as "sent" | "revision_requested" | "confirmed";
}
