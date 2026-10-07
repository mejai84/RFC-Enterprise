"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { loadQuoteTechnicalDocuments, reviewQuoteTechnicalDocuments, uploadQuoteTechnicalDocument } from "../data/technical-document-repository";
import { technicalDocumentLabels, type QuoteTechnicalDocument, type TechnicalDocumentType } from "../domain/technical-document";
import type { QuoteStatus } from "../domain/quote";

const types: TechnicalDocumentType[] = ["work_procedure", "risk_matrix"];
const statusLabel: Record<string, string> = { draft: "Borrador", sent: "Enviado al cliente", changes_requested: "Cambios solicitados", approved: "Aprobado por cliente", superseded: "Versión anterior" };

export function TechnicalDocumentsEditor({ quoteId, onWorkflowStatusChanged }: { quoteId: string; onWorkflowStatusChanged: (status: QuoteStatus, message: string) => void }) {
  const [documents, setDocuments] = useState<QuoteTechnicalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [changeNotes, setChangeNotes] = useState("");
  async function reload() { setIsLoading(true); try { setDocuments(await loadQuoteTechnicalDocuments(quoteId)); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar los documentos técnicos."); } finally { setIsLoading(false); } }
  useEffect(() => {
    let cancelled = false;
    void loadQuoteTechnicalDocuments(quoteId)
      .then((items) => { if (!cancelled) setDocuments(items); })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "No fue posible cargar los documentos técnicos."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [quoteId]);
  const latest = useMemo(() => new Map(types.map((type) => [type, documents.find((document) => document.documentType === type)])), [documents]);
  const latestDocuments = types.map((type) => latest.get(type)).filter(Boolean) as QuoteTechnicalDocument[];
  const workflowStatus = latestDocuments.length === 2 && latestDocuments.every((document) => document.status === latestDocuments[0].status) ? latestDocuments[0].status : undefined;
  async function onFileChange(type: TechnicalDocumentType, event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; setError(""); setMessage(""); setIsBusy(true); try { await uploadQuoteTechnicalDocument(quoteId, type, technicalDocumentLabels[type], file); setMessage(`${technicalDocumentLabels[type]} cargado como nueva versión.`); event.target.value = ""; await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible cargar el archivo."); } finally { setIsBusy(false); } }
  async function review(action: "sent" | "changes_requested" | "approved") { setError(""); setMessage(""); setIsBusy(true); try { const next = await reviewQuoteTechnicalDocuments(quoteId, action, changeNotes); const messages = { sent: "Documentos enviados al cliente para revisión.", changes_requested: "Cambios del cliente registrados. Carga una nueva versión de cada documento.", approved: "Reaprobación del cliente registrada. La cotización quedó confirmada." }; setMessage(messages[action]); onWorkflowStatusChanged(next, messages[action]); setChangeNotes(""); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible actualizar la revisión."); } finally { setIsBusy(false); } }
  return <section className="technical-documents" aria-busy={isLoading}>
    <div className="technical-documents-intro"><div><p className="technical-documents-kicker">Antes de iniciar obra</p><h3>Procedimiento y matriz de riesgos</h3><p>Se conservan todas las versiones. Si el cliente pide cambios, la aprobación anterior deja de ser válida.</p></div><span className={`technical-documents-status is-${workflowStatus ?? "incomplete"}`}>{workflowStatus ? statusLabel[workflowStatus] : "Pendientes de completar"}</span></div>
    {error ? <p className="technical-documents-alert is-error" role="alert">{error}</p> : null}{message ? <p className="technical-documents-alert is-success" role="status" aria-live="polite">{message}</p> : null}
    <div className="technical-document-grid">{types.map((type) => { const document = latest.get(type); const canUpload = !document || ["draft", "changes_requested"].includes(document.status); return <article className="technical-document-card" key={type}><div><span>{type === "work_procedure" ? "01" : "02"}</span><h4>{technicalDocumentLabels[type]}</h4></div>{document ? <><p><strong>V{document.version}</strong> · {statusLabel[document.status]}</p>{document.signedUrl ? <a href={document.signedUrl} rel="noreferrer" target="_blank">Abrir {document.fileName}</a> : <p>Archivo pendiente de cargar.</p>}{document.reviewNotes ? <small>Observación: {document.reviewNotes}</small> : null}</> : <p>Aún no se ha cargado.</p>}{canUpload ? <label className="technical-document-upload">{document ? "Cargar nueva versión" : "Cargar documento"}<input accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={isBusy} onChange={(event) => void onFileChange(type, event)} type="file" /></label> : null}</article>; })}</div>
    {workflowStatus === "draft" ? <button className="quotes-new-btn" disabled={isBusy} onClick={() => void review("sent")} type="button">Enviar documentos al cliente para revisión</button> : null}
    {workflowStatus === "sent" ? <div className="technical-document-review"><p>Registra la respuesta recibida del cliente.</p><div><button className="quotes-new-btn" disabled={isBusy} onClick={() => void review("approved")} type="button">Registrar reaprobación del cliente</button></div><label htmlFor="client-change-notes">Si pidió ajustes, escribe sus observaciones <small>Obligatorio para devolver a modificación</small></label><textarea id="client-change-notes" onChange={(event) => setChangeNotes(event.target.value)} placeholder="Ej. Ajustar controles para trabajo en alturas y actualizar responsable del procedimiento." rows={3} value={changeNotes} /><button className="technical-document-secondary" disabled={isBusy || changeNotes.trim().length < 3} onClick={() => void review("changes_requested")} type="button">El cliente solicitó cambios</button></div> : null}
    {workflowStatus === "changes_requested" ? <p className="technical-documents-alert is-error">Carga una nueva versión del procedimiento y otra de la matriz; después podrás enviarlas nuevamente al cliente.</p> : null}
    {workflowStatus === "approved" ? <p className="technical-documents-approved">Documentación vigente aprobada. Ya se puede convertir esta cotización en obra.</p> : null}
    <details className="technical-documents-versions"><summary>Ver historial de versiones ({documents.length})</summary><ul>{documents.map((document) => <li key={document.id}>{technicalDocumentLabels[document.documentType]} · V{document.version} · {statusLabel[document.status]} · {document.fileName}</li>)}</ul></details>
  </section>;
}
