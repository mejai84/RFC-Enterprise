"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteQuoteCommercialDocument,
  loadQuoteCommercialDocuments,
  registerQuoteCommercialDocument,
} from "../data/commercial-document-repository";
import {
  commercialDocumentEmptyHints,
  commercialDocumentHints,
  commercialDocumentLabels,
  commercialDocumentTypes,
  formatCommercialDocumentSize,
  groupCommercialDocuments,
  validateCommercialDocumentInput,
  type CommercialDocumentType,
  type QuoteCommercialDocument,
} from "../domain/commercial-document";
import styles from "./commercial-file-section.module.css";

type Props = {
  /** Cotización a la que pertenece el expediente. */
  quoteId: string;
  /** Responsable por defecto del soporte; normalmente el de la cotización. */
  defaultResponsible?: string;
  /** Permite ocultar el formulario cuando el usuario solo debe consultar. */
  canEdit?: boolean;
  onChanged?: () => void;
};

/**
 * Expediente comercial de la cotización.
 *
 * Sección independiente y aditiva: no reemplaza ni toca los documentos técnicos
 * (procedimiento de trabajo y matriz de riesgos). Los archivos viven en un
 * bucket privado y se abren con URL firmada de corta duración.
 */
export function CommercialFileSection({
  quoteId,
  defaultResponsible = "",
  canEdit = true,
  onChanged,
}: Props) {
  const [documents, setDocuments] = useState<QuoteCommercialDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openTypes, setOpenTypes] = useState<CommercialDocumentType[]>([]);

  const [formType, setFormType] = useState<CommercialDocumentType>("request_original");
  const [title, setTitle] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [responsible, setResponsible] = useState(defaultResponsible);
  const [notes, setNotes] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // El responsable por defecto llega como valor inicial. Si la ficha cambia de
  // cotización, el padre debe remontar el componente (por ejemplo con `key`).
  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      setDocuments(await loadQuoteCommercialDocuments(quoteId));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar el expediente.");
    } finally {
      setIsLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    let cancelled = false;
    loadQuoteCommercialDocuments(quoteId)
      .then((items) => {
        if (!cancelled) setDocuments(items);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "No fue posible cargar el expediente.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  const grouped = useMemo(() => groupCommercialDocuments(documents), [documents]);
  const total = documents.length;

  function toggleForm(type: CommercialDocumentType) {
    setFormType(type);
    setOpenTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setExternalUrl("");
  }

  function onUrlChange(value: string) {
    setExternalUrl(value);
    if (value.trim()) setFile(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      quoteId,
      documentType: formType,
      title,
      documentDate: documentDate || undefined,
      responsible,
      notes: notes.trim() || undefined,
      file: file ?? undefined,
      externalUrl: externalUrl.trim() || undefined,
    };
    const invalid = validateCommercialDocumentInput(input);
    if (invalid) {
      setError(invalid);
      setMessage("");
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");
    try {
      await registerQuoteCommercialDocument(input);
      setTitle("");
      setDocumentDate("");
      setNotes("");
      setFile(null);
      setExternalUrl("");
      setMessage(`${commercialDocumentLabels[formType]} agregado al expediente.`);
      await reload();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible registrar el soporte.");
    } finally {
      setIsBusy(false);
    }
  }

  async function onDelete(document: QuoteCommercialDocument) {
    setIsBusy(true);
    setError("");
    try {
      await deleteQuoteCommercialDocument(document.id);
      setMessage(`Se quitó ${document.title} del expediente.`);
      await reload();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible eliminar el soporte.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className={styles.section} aria-busy={isLoading}>
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Expediente comercial</p>
          <h3 className={styles.title}>Soportes de la relación con el cliente</h3>
          <p className={styles.subtitle}>
            Solicitud original, planos, correos, orden de servicio y aprobación del cliente. Es un
            registro aparte de los documentos técnicos: no los reemplaza ni participa en la
            conversión a obra.
          </p>
        </div>
        <span className={styles.counter}>
          {isLoading ? "Cargando…" : `${total} soporte${total === 1 ? "" : "s"}`}
        </span>
      </header>

      {error ? (
        <p className={`${styles.alert} ${styles.alertError}`} role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className={`${styles.alert} ${styles.alertSuccess}`} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      {!isLoading && total === 0 ? (
        <p className={styles.emptyGlobal}>
          Este expediente está vacío. Registra la solicitud original del cliente para dejar
          respaldo de cómo nació la cotización.
        </p>
      ) : null}

      <div className={styles.grid}>
        {commercialDocumentTypes.map((type) => {
          const items = grouped[type];
          const isOpen = openTypes.includes(type);
          return (
            <article className={styles.card} key={type}>
              <div className={styles.cardHead}>
                <h4 className={styles.cardTitle}>{commercialDocumentLabels[type]}</h4>
                <span className={items.length ? styles.badge : `${styles.badge} ${styles.badgeEmpty}`}>
                  {items.length ? `${items.length}` : "Pendiente"}
                </span>
              </div>
              <p className={styles.cardHint}>{commercialDocumentHints[type]}</p>

              {items.length ? (
                <ul className={styles.list}>
                  {items.map((document) => (
                    <li className={styles.item} key={document.id}>
                      <p className={styles.itemName}>{document.title}</p>
                      <p className={styles.meta}>
                        <span>{document.documentDate ?? "Sin fecha"}</span>
                        <span>{document.responsible}</span>
                        {document.fileName ? <span>{document.fileName}</span> : null}
                        {document.sizeBytes ? <span>{formatCommercialDocumentSize(document.sizeBytes)}</span> : null}
                      </p>
                      {document.notes ? <p className={styles.notes}>{document.notes}</p> : null}
                      <div className={styles.actions}>
                        {document.externalUrl ? (
                          <a
                            className={styles.link}
                            href={document.externalUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Abrir enlace
                          </a>
                        ) : document.signedUrl ? (
                          <>
                            <a className={styles.link} href={document.signedUrl} rel="noreferrer" target="_blank">
                              Ver documento
                            </a>
                            <a className={styles.link} download={document.fileName} href={document.signedUrl}>
                              Descargar
                            </a>
                          </>
                        ) : (
                          <span className={`${styles.link} ${styles.linkMuted}`}>
                            Archivo no disponible por ahora
                          </span>
                        )}
                        {canEdit ? (
                          <button
                            className={styles.remove}
                            disabled={isBusy}
                            onClick={() => void onDelete(document)}
                            type="button"
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.cardHint}>{commercialDocumentEmptyHints[type]}</p>
              )}

              {canEdit ? (
                <>
                  <button
                    className={styles.toggle}
                    onClick={() => toggleForm(type)}
                    type="button"
                  >
                    {isOpen ? "Ocultar formulario" : "+ Agregar soporte"}
                  </button>
                  {isOpen ? (
                    <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
                      <p className={styles.formTitle}>{commercialDocumentLabels[type]}</p>
                      <label className={styles.field}>
                        <span>Nombre del soporte</span>
                        <input
                          className={styles.input}
                          maxLength={180}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder="Ej. Correo de solicitud con planos adjuntos"
                          required
                          value={title}
                        />
                      </label>
                      <div className={styles.fieldRow}>
                        <label className={styles.field}>
                          <span>Fecha del documento</span>
                          <input
                            className={styles.input}
                            onChange={(event) => setDocumentDate(event.target.value)}
                            type="date"
                            value={documentDate}
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Responsable</span>
                          <input
                            className={styles.input}
                            maxLength={120}
                            onChange={(event) => setResponsible(event.target.value)}
                            placeholder="Quién responde por este soporte"
                            required
                            value={responsible}
                          />
                        </label>
                      </div>
                      <label className={styles.field}>
                        <span>Archivo (PDF, Word, Excel o imagen, hasta 25 MB)</span>
                        <input
                          className={styles.input}
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                          disabled={Boolean(externalUrl.trim())}
                          onChange={onFileChange}
                          type="file"
                        />
                        {file ? <span className={styles.fileName}>{file.name}</span> : null}
                      </label>
                      <label className={styles.field}>
                        <span>o enlace externo (Drive, SharePoint)</span>
                        <input
                          className={styles.input}
                          disabled={Boolean(file)}
                          inputMode="url"
                          onChange={(event) => onUrlChange(event.target.value)}
                          placeholder="https://…"
                          value={externalUrl}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Notas (opcional)</span>
                        <textarea
                          className={styles.textarea}
                          maxLength={1000}
                          onChange={(event) => setNotes(event.target.value)}
                          rows={2}
                          value={notes}
                        />
                      </label>
                      <button className={styles.submit} disabled={isBusy} type="submit">
                        {isBusy ? "Guardando…" : "Guardar en el expediente"}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                <p className={styles.readonlyNote}>Solo consulta: no tienes permiso para modificar el expediente.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default CommercialFileSection;