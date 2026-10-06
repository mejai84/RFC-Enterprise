"use client";

import { useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import { SignatureCapture } from "@/shared/components/signature-capture";
import {
  getEffectiveQuoteCode,
  technicalVisitChecklistTemplates,
  type Quote,
  type TechnicalVisit,
  type TechnicalVisitChecklistItem,
  type TechnicalVisitMeasurement,
} from "@/modules/quotes";

const EVIDENCE_BUCKET = "visit-evidence";

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

/** Normaliza texto para comparar nombres de artículos (sin tildes, minúsculas). */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Interpreta una línea de texto libre como "cantidad + descripción de artículo". */
function parseMissingLine(line: string) {
  const cleaned = line.replace(/\s+/g, " ").trim().replace(/^[-*•]\s*/, "");
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return { quantity: 1, query: cleaned };
  const quantity = Number(match[1].replace(",", "."));
  const query = match[2].replace(/\s*(de|del|para|und\.?|unidades?)\s*$/i, "").trim();
  return { quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1, query: query || cleaned };
}

export function TechnicalVisitEditor({
  quote,
  currentUser,
  onSave,
  onSaveStatus,
}: {
  quote: Quote;
  currentUser: string;
  onSave: (visit: TechnicalVisit) => void;
  onSaveStatus: (status: TechnicalVisit["status"]) => void;
}) {
  const visit = quote.technicalVisit;
  const supabase = useMemo(() => client(), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const [required, setRequired] = useState(visit?.required ?? false);
  const [scheduledDate, setScheduledDate] = useState(visit?.scheduledDate ?? "");
  const [scheduledTime, setScheduledTime] = useState(visit?.scheduledTime ?? "");
  const [responsible, setResponsible] = useState(
    visit?.responsible ?? quote.responsible,
  );
  const [status, setStatus] = useState<TechnicalVisit["status"]>(
    visit?.status ?? "pending",
  );
  const [findings, setFindings] = useState(visit?.findings ?? "");
  const [measurements, setMeasurements] = useState<
    TechnicalVisitMeasurement[]
  >(visit?.measurements ?? []);
  const [checklist, setChecklist] = useState<TechnicalVisitChecklistItem[]>(
    visit?.checklist ?? [],
  );
  const [checklistTemplate, setChecklistTemplate] = useState(
    visit?.checklistTemplate ?? "construccion",
  );
  const [photos, setPhotos] = useState<NonNullable<TechnicalVisit["photos"]>>(
    visit?.photos ?? [],
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signedByName, setSignedByName] = useState(visit?.signedByName ?? "");
  const [signedByRole, setSignedByRole] = useState(visit?.signedByRole ?? "");
  const [geo, setGeo] = useState(visit?.geo ?? undefined);
  const [geoState, setGeoState] = useState<
    "idle" | "capturing" | "ok" | "denied"
  >(visit?.geo ? "ok" : "idle");
  const [materialsMissing, setMaterialsMissing] = useState(
    visit?.materialsMissing ?? "",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [actaToPrint, setActaToPrint] = useState<TechnicalVisit | null>(null);
  const [reqLines, setReqLines] = useState<
    Array<{ id: string; query: string; quantity: number; stockId: string | null; matchName: string | null; unit: string | null; candidates: Array<{ stockId: string; name: string; unit: string }> }>
  >([]);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqCreating, setReqCreating] = useState(false);

  /** Carga candidatos del catálogo para que el almacén valide qué artículo es. */
  async function searchCatalog(query: string, signal: { canceled: boolean }) {
    const db = supabase;
    if (!db || query.length < 2) return [];
    const { data, error } = await db
      .from("inventory_stock")
      .select("id, inventory_items!inner(name, unit)")
      .ilike("inventory_items.name", `%${query}%`)
      .limit(8);
    if (signal.canceled || error || !data) return [];
    return data.map((row) => {
      const item = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
      return { stockId: row.id as string, name: item?.name ?? "", unit: item?.unit ?? "" };
    });
  }

  async function openRequisitionBuilder() {
    const parsed = materialsMissing
      .split(/\r?\n|;/)
      .map(parseMissingLine)
      .filter((entry): entry is { quantity: number; query: string } => Boolean(entry));
    if (!parsed.length) {
      setNotice("Escribe al menos un material faltante antes de crear la requisición.");
      return;
    }
    if (!quote.projectId) {
      setNotice(
        "Esta cotización todavía no tiene obra. Conviértela en obra y luego crea la requisición desde la ficha de la obra.",
      );
      return;
    }
    const lines = parsed.map((entry, index) => ({
      id: `${Date.now()}-${index}`,
      query: entry.query,
      quantity: entry.quantity,
      stockId: null as string | null,
      matchName: null as string | null,
      unit: null as string | null,
      candidates: [] as Array<{ stockId: string; name: string; unit: string }>,
    }));
    setReqLines(lines);
    setReqOpen(true);
    await Promise.all(
      lines.map(async (line) => {
        const candidates = await searchCatalog(line.query, { canceled: false });
        setReqLines((current) =>
          current.map((row) => (row.id === line.id ? { ...row, candidates } : row)),
        );
      }),
    );
  }

  async function createRequisition() {
    const db = supabase;
    if (!db || !quote.projectId) return;
    const selected = reqLines.filter((line) => line.stockId && line.quantity > 0);
    if (!selected.length) {
      setNotice("Selecciona el artículo de al menos una línea.");
      return;
    }
    setReqCreating(true);
    const { data, error } = await db.rpc("create_inventory_requisition", {
      target_project: quote.projectId,
      requester_name: visit?.responsible ?? quote.responsible ?? currentUser,
      target_needed_by: scheduledDate || null,
      request_notes: `Generada desde la visita técnica de la cotización ${getEffectiveQuoteCode(quote)}.`,
      request_lines: selected.map((line) => ({
        stock_id: line.stockId,
        quantity: line.quantity,
        notes: line.matchName ? `Solicitado como "${line.query}"` : null,
      })),
    });
    setReqCreating(false);
    if (error) {
      setNotice(`No fue posible crear la requisición: ${error.message}`);
      return;
    }
    const created = Array.isArray(data) ? data[0] : data;
    const code = created?.requisition_code ?? created?.code ?? "REQ";
    onSave({
      ...buildVisit(),
      linkedRequisitionId: created?.requisition_id ?? created?.id,
      linkedRequisitionCode: code,
    });
    setReqOpen(false);
    setNotice(`Requisición ${code} creada y enviada al almacén.`);
  }

  const isOverdue =
    required &&
    status === "pending" &&
    Boolean(scheduledDate) &&
    scheduledDate < new Date().toISOString().slice(0, 10);
  const checklistPending = checklist.filter((item) => !item.done).length;

  function applyTemplate(key: string) {
    setChecklistTemplate(key);
    const template = technicalVisitChecklistTemplates[key];
    setChecklist((previous) =>
      template.items.map((label) => previous.find((i) => i.label === label) ?? { label, done: false }),
    );
  }

  function captureGeo() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNotice("Este dispositivo no reporta ubicación.");
      return;
    }
    setGeoState("capturing");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGeoState("ok");
      },
      () => {
        setGeoState("denied");
        setNotice("No se pudo obtener la ubicación: el permiso fue denegado.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    const db = supabase;
    if (!db) {
      setNotice("No fue posible conectar con el almacenamiento de evidencias.");
      return;
    }
    const uploaded: NonNullable<TechnicalVisit["photos"]> = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 8 * 1024 * 1024) {
        setNotice(`"${file.name}" supera el límite de 8 MB y fue omitida.`);
        continue;
      }
      const path = `${quote.id}/visita/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await db.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (error) {
        setNotice(`No se pudo subir "${file.name}": ${error.message}`);
        continue;
      }
      uploaded.push({ storagePath: path, fileName: file.name, uploadedAt: new Date().toISOString() });
    }
    if (uploaded.length) {
      setPhotos((previous) => [...previous, ...uploaded]);
      setNotice(`${uploaded.length} evidencia(s) fotográfica(s) adjunta(s).`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function persistSignature(existing: string) {
    setSignatureDataUrl(existing);
    if (!existing) return;
    const db = supabase;
    if (!db) return;
    const blob = await (await fetch(existing)).blob();
    const path = `${quote.id}/visita/firma-${Date.now()}.png`;
    const { error } = await db.storage.from(EVIDENCE_BUCKET).upload(path, blob, { contentType: "image/png" });
    if (error) {
      setNotice(`Firma capturada, pero no se pudo subir: ${error.message}`);
      return;
    }
    setSignatureDataUrl(path);
  }

  function closeVisit() {
    if (!required) {
      setNotice("Active la visita técnica antes de cerrarla.");
      return;
    }
    if (!signatureDataUrl) {
      setNotice("Para cerrar la visita se requiere la firma del cliente o encargado.");
      return;
    }
    if (checklistPending > 0) {
      setNotice(
        `Faltan ${checklistPending} punto(s) de la lista de chequeo por verificar.`,
      );
      return;
    }
    onSaveStatus("completed");
    setStatus("completed");
  }

  function buildVisit(): TechnicalVisit {
    return {
      required,
      scheduledDate: scheduledDate || undefined,
      scheduledTime: scheduledTime || undefined,
      responsible: responsible || undefined,
      status,
      findings: findings || undefined,
      measurements: measurements.filter((m) => m.concept.trim()),
      photos,
      checklist,
      checklistTemplate,
      signaturePath: signatureDataUrl.startsWith("http")
        ? visit?.signaturePath
        : signatureDataUrl || visit?.signaturePath,
      signedByName: signedByName || undefined,
      signedByRole: signedByRole || undefined,
      signedAt: signatureDataUrl ? new Date().toISOString() : visit?.signedAt,
      geo,
      executedAt: status === "completed" ? new Date().toISOString() : visit?.executedAt,
      closedBy: status === "completed" ? currentUser : visit?.closedBy,
      materialsMissing: materialsMissing || undefined,
    };
  }

  return (
    <div className="visit-editor">
      {isOverdue && (
        <p className="visit-alert" role="status">
          ⏰ Visita técnica vencida: fue programada para el {scheduledDate} y sigue
          pendiente.
        </p>
      )}
      {notice && (
        <p className="visit-alert" role="status">
          {notice}
        </p>
      )}

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => {
            setRequired(e.target.checked);
            if (!e.target.checked) setStatus("not_required");
            else if (status === "not_required") setStatus("pending");
          }}
        />
        <span>Requiere visita técnica de inspección en campo</span>
      </label>

      {required && (
        <>
          <div className="new-quote-row" style={{ marginTop: "14px" }}>
            <label className="form-field">
              Fecha programada
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </label>
            <label className="form-field">
              Hora programada
              <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </label>
            <label className="form-field">
              Ingeniero / Inspector responsable
              <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Ej: Ing. Jorge Figueroa" />
            </label>
          </div>

          <label className="form-field" style={{ marginTop: "14px" }}>
            Estado de la visita
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TechnicalVisit["status"])}
              className="status-select"
              style={{ padding: "10px" }}
            >
              <option value="pending">⏳ Visita pendiente de realización</option>
              <option value="completed">✓ Visita técnica ejecutada a satisfacción</option>
              <option value="not_required">✕ No requerida / Cancelada</option>
            </select>
          </label>

          {/* Lista de chequeo técnica */}
          <section className="visit-section">
            <div className="visit-section-head">
              <strong>Lista de chequeo en sitio</strong>
              <select value={checklistTemplate} onChange={(e) => applyTemplate(e.target.value)} className="status-select">
                {Object.entries(technicalVisitChecklistTemplates).map(([key, template]) => (
                  <option key={key} value={key}>{template.label}</option>
                ))}
              </select>
            </div>
            <label className="checkbox-field">
              <input type="checkbox" onClick={() => applyTemplate(checklistTemplate)} />
              <span>Cargar plantilla para el tipo de servicio</span>
            </label>
            {checklist.map((item, index) => (
              <label key={item.label} className="checkbox-field">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) =>
                    setChecklist((previous) =>
                      previous.map((row, i) => (i === index ? { ...row, done: e.target.checked } : row)),
                    )
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </section>

          {/* Mediciones estructuradas */}
          <section className="visit-section">
            <div className="visit-section-head">
              <strong>Mediciones y conceptos verificados</strong>
              <button
                type="button"
                className="btn-mini"
                onClick={() => setMeasurements((p) => [...p, { concept: "", quantity: undefined, unit: "", notes: "" }])}
              >
                + Agregar medición
              </button>
            </div>
            {measurements.map((row, index) => (
              <div key={index} className="visit-measurement-row">
                <input
                  type="text"
                  placeholder="Concepto (ej: longitud de tubería)"
                  value={row.concept}
                  onChange={(e) => setMeasurements((p) => p.map((m, i) => (i === index ? { ...m, concept: e.target.value } : m)))}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Cantidad"
                  value={row.quantity ?? ""}
                  onChange={(e) => setMeasurements((p) => p.map((m, i) => (i === index ? { ...m, quantity: e.target.value === "" ? undefined : Number(e.target.value) } : m)))}
                />
                <input
                  type="text"
                  placeholder="Unidad"
                  value={row.unit ?? ""}
                  onChange={(e) => setMeasurements((p) => p.map((m, i) => (i === index ? { ...m, unit: e.target.value } : m)))}
                />
                <input
                  type="text"
                  placeholder="Nota"
                  value={row.notes ?? ""}
                  onChange={(e) => setMeasurements((p) => p.map((m, i) => (i === index ? { ...m, notes: e.target.value } : m)))}
                />
                <button type="button" className="btn-cancel" onClick={() => setMeasurements((p) => p.filter((_, i) => i !== index))}>
                  Quitar
                </button>
              </div>
            ))}
          </section>

          <label className="form-field" style={{ marginTop: "14px" }}>
            Hallazgos, observaciones y alcance en campo
            <textarea
              rows={4}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Indicar estado del terreno, accesos, requerimientos de andamiaje, redes eléctricas..."
            />
          </label>

          {/* Evidencia fotográfica */}
          <section className="visit-section">
            <div className="visit-section-head">
              <strong>Evidencia fotográfica</strong>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => void uploadPhotos(e.target.files)}
                  hidden
                />
                <button type="button" className="btn-mini" onClick={() => fileRef.current?.click()}>
                  📷 Adjuntar fotos
                </button>
              </div>
            </div>
            {photos.length > 0 && (
              <div className="visit-photo-grid">
                {photos.map((photo) => {
                  const url = supabase
                    ? supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(photo.storagePath).data.publicUrl
                    : "";
                  return (
                    <figure key={photo.storagePath} className="visit-photo">
                      {url ? (
                        <Image src={url} alt={photo.fileName} width={160} height={120} unoptimized />
                      ) : (
                        <span>{photo.fileName}</span>
                      )}
                      <figcaption>
                        <button
                          type="button"
                          className="btn-cancel"
                          onClick={() => setPhotos((p) => p.filter((row) => row.storagePath !== photo.storagePath))}
                        >
                          Quitar
                        </button>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </section>

          {/* Ubicación de la visita */}
          <section className="visit-section">
            <div className="visit-section-head">
              <strong>Ubicación de la visita</strong>
              <button type="button" className="btn-mini" onClick={captureGeo} disabled={geoState === "capturing"}>
                {geoState === "capturing" ? "Obteniendo ubicación…" : "📍 Capturar ubicación actual"}
              </button>
            </div>
            {geo ? (
              <p className="visit-geo">
                {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)}
                {geo.accuracy ? ` (±${Math.round(geo.accuracy)} m)` : ""} ·{" "}
                <a
                  href={`https://www.google.com/maps?q=${geo.latitude},${geo.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver en mapa
                </a>
              </p>
            ) : (
              <p className="visit-geo">Ubicación no capturada.</p>
            )}
          </section>

          {/* Cierre con firma */}
          <section className="visit-section">
            <div className="visit-section-head">
              <strong>Cierre de la visita</strong>
              <span className="visit-signature-state">
                {signatureDataUrl ? "Firma capturada" : "Firma pendiente"}
              </span>
            </div>
            <div className="new-quote-row">
              <label className="form-field">
                Nombre de quien firma
                <input type="text" value={signedByName} onChange={(e) => setSignedByName(e.target.value)} placeholder="Cliente / encargado del sitio" />
              </label>
              <label className="form-field">
                Cargo / relación
                <input type="text" value={signedByRole} onChange={(e) => setSignedByRole(e.target.value)} placeholder="Ej: Representative de obra" />
              </label>
            </div>
            <SignatureCapture label="Capturar firma de cierre" value="" onChange={(value) => void persistSignature(value)} />
            <label className="form-field" style={{ marginTop: "12px" }}>
              Insumos o materiales faltantes detectados
              <textarea
                rows={2}
                value={materialsMissing}
                onChange={(e) => setMaterialsMissing(e.target.value)}
                placeholder="Ej: 20 m de tubería, 4 开始 de soldadura..."
              />
            </label>
            {materialsMissing.trim() && (
              <div className="visit-requ requisition-actions">
                {visit?.linkedRequisitionCode && (
                  <p className="visit-alert is-info">
                    Requisición <strong>{visit.linkedRequisitionCode}</strong> enviada al
                    almacén desde esta visita.
                  </p>
                )}
                <button
                  type="button"
                  className="btn-mini"
                  style={{ marginTop: "8px" }}
                  onClick={() => void openRequisitionBuilder()}
                >
                  📦 Crear requisición con estos faltantes
                </button>
              </div>
            )}
          </section>

          <div className="visit-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setActaToPrint(buildVisit())}
            >
              🖨️ Imprimir acta de visita
            </button>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => closeVisit()}
            >
              ✓ Cerrar visita con firma
            </button>
            <button
              type="button"
              className="quotes-new-btn"
              onClick={() => {
                onSave(buildVisit());
                setNotice("Visita técnica guardada.");
              }}
            >
              Guardar Datos de Visita
            </button>
          </div>
        </>
      )}

      {reqOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Crear requisición desde la visita técnica"
        >
          <div className="modal-card visit-requisition-modal">
            <div className="modal-header">
              <div>
                <p>Visita técnica · {getEffectiveQuoteCode(quote)}</p>
                <h3>Crear requisición al almacén</h3>
              </div>
              <button
                className="btn-close-modal"
                type="button"
                onClick={() => setReqOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <p className="panel-intro">
              Confirma el artículo del catálogo y la cantidad. El almacén despacha desde
              la obra {quote.projectCode ?? ""}.
            </p>
            <div className="visit-requisition-lines">
              {reqLines.map((line) => (
                <div key={line.id} className="visit-requisition-line">
                  <div className="visit-requisition-head">
                    <code>{line.query}</code>
                    <label>
                      Cantidad
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.quantity}
                        onChange={(event) =>
                          setReqLines((current) =>
                            current.map((row) =>
                              row.id === line.id
                                ? { ...row, quantity: Number(event.target.value) || 0 }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  {line.candidates.length === 0 ? (
                    <p className="visit-requisition-empty">
                      Sin coincidencias en el catálogo. Ajusta el texto o crea primero el
                      artículo en Inventarios.
                    </p>
                  ) : (
                    <ul className="visit-requisition-candidates">
                      {line.candidates.map((candidate) => (
                        <li key={candidate.stockId}>
                          <button
                            type="button"
                            className={
                              line.stockId === candidate.stockId ? "is-selected" : ""
                            }
                            onClick={() =>
                              setReqLines((current) =>
                                current.map((row) =>
                                  row.id === line.id
                                    ? {
                                        ...row,
                                        stockId: candidate.stockId,
                                        matchName: candidate.name,
                                        unit: candidate.unit,
                                      }
                                    : row,
                                ),
                              )
                            }
                          >
                            {candidate.name}
                            <small>{candidate.unit}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setReqOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="inventory-action"
                disabled={reqCreating}
                onClick={() => void createRequisition()}
              >
                {reqCreating ? "Enviando…" : "Enviar requisición"}
              </button>
            </div>
          </div>
        </div>
      )}

      {actaToPrint && (
        <TechnicalVisitActaModal
          quote={quote}
          visit={actaToPrint}
          signatureUrl={
            actaToPrint.signaturePath?.startsWith("http") || !actaToPrint.signaturePath
              ? (actaToPrint.signaturePath ?? "")
              : supabase
                ? supabase.storage
                    .from(EVIDENCE_BUCKET)
                    .getPublicUrl(actaToPrint.signaturePath).data.publicUrl
                : ""
          }
          photoUrls={(actaToPrint.photos ?? []).map((photo) =>
            supabase
              ? supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(photo.storagePath).data.publicUrl
              : "",
          )}
          onClose={() => setActaToPrint(null)}
        />
      )}
    </div>
  );
}

function TechnicalVisitActaModal({
  quote,
  visit,
  signatureUrl,
  photoUrls,
  onClose,
}: {
  quote: Quote;
  visit: TechnicalVisit;
  signatureUrl: string;
  photoUrls: string[];
  onClose: () => void;
}) {
  const executed = visit.executedAt ? new Date(visit.executedAt) : new Date();
  return (
    <div className="quote-modal-backdrop printable-backdrop" onClick={onClose}>
      <div
        className="printable-proposal-wrapper visit-acta-wrapper"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="print-controls no-print">
          <div className="print-controls-left">
            <strong>Acta de visita técnica</strong>
            <span>{getEffectiveQuoteCode(quote)}</span>
          </div>
          <div className="print-controls-right">
            <button className="quotes-new-btn" onClick={() => window.print()}>
              🖨️ Imprimir / Guardar en PDF
            </button>
            <button className="quotes-cancel-btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <article className="formal-proposal-sheet visit-acta-sheet">
          <header className="proposal-header">
            <h2>ACTA DE VISITA TÉCNICA DE CAMPO</h2>
            <p>
              {quote.code} · {quote.title}
            </p>
          </header>

          <table className="visit-acta-table">
            <tbody>
              <tr>
                <th>Cliente</th>
                <td>{quote.client}</td>
                <th>Responsable de la visita</th>
                <td>{visit.responsible ?? "—"}</td>
              </tr>
              <tr>
                <th>Fecha programada</th>
                <td>
                  {visit.scheduledDate ?? "—"} {visit.scheduledTime ?? ""}
                </td>
                <th>Fecha de ejecución</th>
                <td>{executed.toLocaleString("es-CO")}</td>
              </tr>
              <tr>
                <th>Estado</th>
                <td>
                  {visit.status === "completed"
                    ? "Ejecutada a satisfacción"
                    : visit.status === "not_required"
                      ? "No requerida"
                      : "Pendiente"}
                </td>
                <th>Cerrada por</th>
                <td>{visit.closedBy ?? "—"}</td>
              </tr>
              {visit.geo ? (
                <tr>
                  <th>Ubicación</th>
                  <td colSpan={3}>
                    {visit.geo.latitude.toFixed(6)}, {visit.geo.longitude.toFixed(6)}
                    {visit.geo.accuracy ? ` (±${Math.round(visit.geo.accuracy)} m)` : ""}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {(visit.checklist?.length ?? 0) > 0 && (
            <section className="visit-acta-block">
              <h3>Lista de chequeo</h3>
              <ul>
                {visit.checklist!.map((item) => (
                  <li key={item.label}>
                    {item.done ? "☑" : "☐"} {item.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(visit.measurements?.length ?? 0) > 0 && (
            <section className="visit-acta-block">
              <h3>Mediciones y conceptos verificados</h3>
              <table className="visit-acta-table">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {visit.measurements!.map((row, index) => (
                    <tr key={`${row.concept}-${index}`}>
                      <td>{row.concept}</td>
                      <td>{row.quantity ?? "—"}</td>
                      <td>{row.unit ?? "—"}</td>
                      <td>{row.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {visit.findings && (
            <section className="visit-acta-block">
              <h3>Hallazgos y alcance</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{visit.findings}</p>
            </section>
          )}

          {visit.materialsMissing && (
            <section className="visit-acta-block">
              <h3>Insumos faltantes detectados</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{visit.materialsMissing}</p>
            </section>
          )}

          {photoUrls.length > 0 && (
            <section className="visit-acta-block">
              <h3>Evidencia fotográfica</h3>
              <div className="visit-acta-photos">
                {photoUrls.map((url) => (
                  <img key={url} src={url} alt="Evidencia de la visita" />
                ))}
              </div>
            </section>
          )}

          <section className="visit-acta-signatures">
            <div>
              <span>{visit.signedByName ?? "Cliente / encargado"}</span>
              <small>{visit.signedByRole ?? ""}</small>
              <small>Firma: {visit.signedAt ?? "—"}</small>
            </div>
            <div className="visit-acta-signature-image">
              {signatureUrl ? (
                <img src={signatureUrl} alt="Firma de la visita" />
              ) : (
                <small>Firma no capturada</small>
              )}
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
