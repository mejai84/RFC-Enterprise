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

export function TechnicalVisitEditor({
  quote,
  currentUser,
  onSave,
  onSaveStatus,
  onCreateRequisition,
}: {
  quote: Quote;
  currentUser: string;
  onSave: (visit: TechnicalVisit) => void;
  onSaveStatus: (status: TechnicalVisit["status"]) => void;
  onCreateRequisition: (materialsMissing: string) => void;
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
              <button
                type="button"
                className="btn-mini"
                style={{ marginTop: "8px" }}
                onClick={() => onCreateRequisition(materialsMissing.trim())}
              >
                📦 Crear requisición con estos faltantes
              </button>
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
