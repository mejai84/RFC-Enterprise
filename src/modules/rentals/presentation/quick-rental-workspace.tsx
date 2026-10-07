"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";
import { getInventoryItemKind, inventoryProducts, type StockProduct } from "@/modules/inventory";
import {
  ATTACHMENT_LABELS,
  nextQuickRentalCode,
  rentalDays,
  rentalTotal,
  type AttachmentKind,
  type QuickRental,
  type QuickRentalAttachment,
} from "../domain/quick-rental";
import { SignatureCapture } from "@/shared/components/signature-capture";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const localDateTime = (daysFromNow = 0) => {
  const d = new Date(); d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 16);
};
const moneyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("es-CO").format(Number(digits)) : "";
};
const moneyValue = (value: FormDataEntryValue | null) =>
  Number(String(value ?? "").replace(/\D/g, "")) || 0;
const colombianPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const local = (digits.startsWith("57") ? digits.slice(2) : digits).slice(0, 10);
  const groups = [local.slice(0, 3), local.slice(3, 6), local.slice(6, 8), local.slice(8, 10)].filter(Boolean);
  return local ? `+57 ${groups.join(" ")}` : "";
};
const supabase = () =>
  isSupabaseConfigured && supabaseUrl && supabasePublishableKey
    ? createBrowserClient(supabaseUrl, supabasePublishableKey)
    : null;

// ─── Factura imprimible ───────────────────────────────────────────────────────
function InvoiceModal({ rental, onClose }: { rental: QuickRental; onClose: () => void }) {
  const days  = rentalDays(rental.pickupAt, rental.dueAt);
  const total = rentalTotal(rental);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="invoice-title">
      <div className="modal-card" style={{ maxWidth: 640, padding: "2rem" }}>
        <div className="modal-header">
          <div>
            <p>Alquiler · RFC Enterprise</p>
            <h3 id="invoice-title">Factura de Alquiler — {rental.code}</h3>
          </div>
          <button className="btn-close-modal" aria-label="Cerrar" onClick={onClose} type="button">×</button>
        </div>

        {/* Contenido imprimible */}
        <div id="rental-invoice-print" style={{ fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #16a34a", paddingBottom: "1rem", marginBottom: "1rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rfc-logo.svg" alt="RFC Enterprise" style={{ height: 48 }} />
            <div style={{ textAlign: "right" }}>
              <strong style={{ fontSize: 16 }}>{rental.code}</strong><br />
              <span style={{ color: "#6b7280" }}>Alquiler rápido</span><br />
              <span>{new Date(rental.pickupAt).toLocaleDateString("es-CO")}</span>
            </div>
          </div>

          {/* Cliente */}
          <table style={{ width: "100%", marginBottom: "1rem", borderCollapse: "collapse" }}>
            <tbody>
              <tr><td style={{ fontWeight: 600, width: 140, paddingBottom: 4 }}>Cliente</td><td>{rental.customerName}</td></tr>
              <tr><td style={{ fontWeight: 600, paddingBottom: 4 }}>Documento</td><td>{rental.customerDocument}</td></tr>
              <tr><td style={{ fontWeight: 600, paddingBottom: 4 }}>Teléfono</td><td>{rental.customerPhone}</td></tr>
            </tbody>
          </table>

          {/* Detalle */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
            <thead>
              <tr style={{ background: "#16a34a", color: "#fff" }}>
                <th style={{ padding: "6px 8px", textAlign: "left" }}>Descripción</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Días</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Tarifa / día</th>
                <th style={{ padding: "6px 8px", textAlign: "right" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "6px 8px" }}>{rental.equipmentName}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{days}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{cop.format(rental.dailyRate)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{cop.format(days * rental.dailyRate)}</td>
              </tr>
              {(rental.extraCharge ?? 0) > 0 && (
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "6px 8px" }}>Cargos adicionales</td>
                  <td colSpan={2} />
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{cop.format(rental.extraCharge ?? 0)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totales */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginBottom: "1.5rem" }}>
            <span>Depósito / Garantía: <strong>{cop.format(rental.deposit)}</strong></span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>TOTAL: {cop.format(total)}</span>
          </div>

          {/* Notas */}
          {rental.deliveryNotes && <p style={{ color: "#4b5563", marginBottom: 8 }}><strong>Estado inicial:</strong> {rental.deliveryNotes}</p>}
          {rental.returnNotes   && <p style={{ color: "#4b5563", marginBottom: 8 }}><strong>Estado al devolver:</strong> {rental.returnNotes}</p>}

          {/* Firmas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginTop: "2rem" }}>
            <div style={{ paddingTop: 8, textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/rfc-signature.png" alt="Firma de Jorge Figueroa Castro" style={{ display: "block", height: 42, margin: "0 auto 6px", objectFit: "contain", width: 160 }} />
              <small>Jorge Figueroa Castro · Representante Legal</small>
            </div>
            <div style={{ borderTop: "1px solid #9ca3af", paddingTop: 8, textAlign: "center" }}>
              <small>Firma cliente · {rental.customerName}</small>
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
          <button className="btn-cancel" type="button" onClick={onClose}>Cerrar</button>
          <button className="inventory-action" type="button" onClick={() => window.print()}>🖨 Imprimir factura</button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel de adjuntos ────────────────────────────────────────────────────────
function AttachmentsPanel({ rental }: { rental: QuickRental }) {
  const [attachments, setAttachments] = useState<QuickRentalAttachment[]>(rental.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<AttachmentKind>("id_document");

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const db = supabase();
    if (!db) { setNotice("Sin conexión a Supabase."); return; }
    setUploading(true);
    try {
      const path = `${rental.id}/${kind}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const { error: upErr } = await db.storage.from("rental-attachments").upload(path, file);
      if (upErr) throw upErr;
      const { data: row, error: insErr } = await db
        .from("quick_rental_attachments")
        .insert({ rental_id: rental.id, company_id: rental.companyId, kind, storage_path: path, file_name: file.name, mime_type: file.type })
        .select("id, rental_id, kind, storage_path, file_name, mime_type, uploaded_at")
        .single();
      if (insErr) throw insErr;
      if (row) {
        setAttachments((prev) => [...prev, {
          id: row.id, rentalId: row.rental_id, kind: row.kind as AttachmentKind,
          storagePath: row.storage_path, fileName: row.file_name, mimeType: row.mime_type, uploadedAt: row.uploaded_at,
        }]);
      }
      setNotice("Adjunto subido correctamente.");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Error al subir.");
    } finally {
      setUploading(false);
    }
  }

  async function getUrl(path: string) {
    const db = supabase();
    if (!db) return;
    const { data } = await db.storage.from("rental-attachments").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(att: QuickRentalAttachment) {
    const db = supabase();
    if (!db) return;
    await db.storage.from("rental-attachments").remove([att.storagePath]);
    await db.from("quick_rental_attachments").delete().eq("id", att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  }

  return (
    <div className="rental-attachments">
      <h4 style={{ marginBottom: "0.5rem", fontSize: 13, color: "#6b7280" }}>Adjuntos ({attachments.length})</h4>
      {notice && <p style={{ color: "#16a34a", fontSize: 12, marginBottom: 6 }}>{notice}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as AttachmentKind)} style={{ fontSize: 12, padding: "4px 8px" }}>
          {(Object.entries(ATTACHMENT_LABELS) as [AttachmentKind, string][]).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ fontSize: 12 }} />
        <button className="inventory-action" type="button" style={{ padding: "4px 10px", fontSize: 12 }} disabled={uploading} onClick={upload}>
          {uploading ? "Subiendo…" : "↑ Subir"}
        </button>
      </div>
      {attachments.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {attachments.map((att) => (
            <li key={att.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
              <span style={{ flex: 1 }}>
                <strong>{ATTACHMENT_LABELS[att.kind]}</strong> — {att.fileName ?? att.storagePath.split("/").pop()}
              </span>
              <button type="button" style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 12 }} onClick={() => getUrl(att.storagePath)}>Ver</button>
              <button type="button" style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12 }} onClick={() => remove(att)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Workspace principal ──────────────────────────────────────────────────────
export function QuickRentalWorkspace() {
  // Catalogo de referencia: viene del catalogo local, nunca de localStorage como confirmacion.
  const [products, setProducts] = useState<StockProduct[]>(() => [...inventoryProducts]);
  const [rentals, setRentals] = useState<QuickRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [branchId, setBranchId] = useState<string | undefined>();
  const [invoicing, setInvoicing] = useState<QuickRental | null>(null);
  const [pendingRental, setPendingRental] = useState<QuickRental | null>(null);
  const [deliverySignature, setDeliverySignature] = useState("");
  const [dailyRateInput, setDailyRateInput] = useState("");
  const [depositInput, setDepositInput] = useState("0");
  const rentalFormRef = useRef<HTMLFormElement>(null);

  const rentable = useMemo(
    () => products.filter((p) => p.available > 0 && ["equipment", "tool"].includes(getInventoryItemKind(p))),
    [products]
  );
  const activeRentals = rentals.filter((r) => r.status !== "returned");

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4500);
  }, []);

  // ── Cargar desde Supabase (con fallback a localStorage) ───────────────────
  useEffect(() => {
    async function load() {
      const db = supabase();
      if (!db) {
        // Sin sesion no se confirma nada: lista vacia y error explícito.
        setRentals([]);
        setLoading(false);
        return;
      }
      // Leer empresa y sede del perfil
      const { data: profile } = await db.from("profiles").select("company_id, branch_id").eq("id", (await db.auth.getUser()).data.user?.id ?? "").maybeSingle();
      if (profile) { setCompanyId(profile.company_id); setBranchId(profile.branch_id); }

      const { data: rows } = await db
        .from("quick_rentals")
        .select("*, quick_rental_attachments(*)")
        .order("created_at", { ascending: false });

      if (rows) {
        setRentals(rows.map((r) => ({
          id: r.id, code: r.code, equipmentId: r.equipment_id ?? "", equipmentName: r.equipment_name,
          customerName: r.customer_name, customerPhone: r.customer_phone, customerDocument: r.customer_document,
          pickupAt: r.pickup_at, dueAt: r.due_at, returnedAt: r.returned_at ?? undefined,
          dailyRate: r.daily_rate, deposit: r.deposit, extraCharge: r.extra_charge ?? 0,
          status: r.status as QuickRental["status"],
          deliveryNotes: r.delivery_notes ?? undefined, returnNotes: r.return_notes ?? undefined,
          companyId: r.company_id, branchId: r.branch_id ?? undefined,
          attachments: (r.quick_rental_attachments ?? []).map((a: Record<string, string>) => ({
            id: a.id, rentalId: a.rental_id, kind: a.kind as AttachmentKind,
            storagePath: a.storage_path, fileName: a.file_name, mimeType: a.mime_type, uploadedAt: a.uploaded_at,
          })),
        })));
      }
      setLoading(false);
    }
    void load();
  }, []);

  // ── Guardar alquiler ──────────────────────────────────────────────────────
  async function createRental(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const equipment = products.find((p) => p.id === data.get("equipmentId"));
    const pickupAt = String(data.get("pickupAt"));
    const dueAt    = String(data.get("dueAt"));
    if (!equipment || equipment.available < 1 || !pickupAt || !dueAt || dueAt <= pickupAt) {
      showNotice("Seleccione un equipo disponible y una devolución posterior a la entrega.");
      return;
    }
    const rental: QuickRental = {
      id: crypto.randomUUID(),
      code: nextQuickRentalCode(rentals),
      equipmentId: equipment.id, equipmentName: equipment.name,
      customerName: String(data.get("customerName") || "").trim(),
      customerPhone: String(data.get("customerPhone") || "").trim(),
      customerDocument: String(data.get("customerDocument") || "").trim(),
      pickupAt, dueAt, dailyRate: moneyValue(data.get("dailyRate")),
      deposit: moneyValue(data.get("deposit")), status: "active",
      deliveryNotes: String(data.get("deliveryNotes") || "").trim() || undefined,
      companyId, branchId, attachments: [],
    };

    setPendingRental(rental);
    setDeliverySignature("");
  }

  // ── Registrar devolución ──────────────────────────────────────────────────
  async function confirmRentalDelivery() {
    if (!pendingRental || !deliverySignature) {
      showNotice("Capture la firma del cliente para confirmar la entrega.");
      return;
    }

    const equipment = products.find((item) => item.id === pendingRental.equipmentId);
    if (!equipment || equipment.available < 1) {
      showNotice("El equipo ya no está disponible. Revise el inventario e intente nuevamente.");
      return;
    }

    const rental: QuickRental = { ...pendingRental, deliverySignatureDataUrl: deliverySignature };
    const db = supabase();
    if (db && companyId) {
      const { error } = await db.from("quick_rentals").insert({
        id: rental.id, company_id: companyId, branch_id: branchId ?? null,
        code: rental.code, equipment_id: rental.equipmentId || null, equipment_name: rental.equipmentName,
        customer_name: rental.customerName, customer_phone: rental.customerPhone, customer_document: rental.customerDocument,
        pickup_at: rental.pickupAt, due_at: rental.dueAt, daily_rate: rental.dailyRate,
        deposit: rental.deposit, status: rental.status, delivery_notes: rental.deliveryNotes ?? null,
      });
      if (error) { showNotice(`Error: ${error.message}`); return; }

      try {
        const signatureBlob = await (await fetch(deliverySignature)).blob();
        const path = `${rental.id}/signature/${Date.now()}_firma-entrega.png`;
        const { error: uploadError } = await db.storage.from("rental-attachments").upload(path, signatureBlob, { contentType: "image/png" });
        if (uploadError) throw uploadError;
        const { data: attachment, error: attachmentError } = await db
          .from("quick_rental_attachments")
          .insert({ rental_id: rental.id, company_id: rental.companyId, kind: "signature", storage_path: path, file_name: "firma-entrega.png", mime_type: "image/png" })
          .select("id, rental_id, kind, storage_path, file_name, mime_type, uploaded_at")
          .single();
        if (attachmentError) throw attachmentError;
        if (attachment) {
          rental.attachments = [{
            id: attachment.id, rentalId: attachment.rental_id, kind: attachment.kind as AttachmentKind,
            storagePath: attachment.storage_path, fileName: attachment.file_name,
            mimeType: attachment.mime_type, uploadedAt: attachment.uploaded_at,
          }];
        }
      } catch (signatureError) {
        showNotice(`Alquiler creado, pero la firma no pudo guardarse: ${signatureError instanceof Error ? signatureError.message : "intente adjuntarla desde el registro"}.`);
      }
    } else {
      // Sin sesion activa: no se confirma el alquiler, se avisa al usuario.
      showNotice("No fue posible guardar el alquiler: inicia sesión en RFC Enterprise para persistirlo en Supabase.");
      return;
    }

    setRentals((prev) => [rental, ...prev]);
    setProducts((prev) => prev.map((item) => item.id === equipment.id ? { ...item, available: item.available - 1 } : item));
    rentalFormRef.current?.reset();
    setDailyRateInput("");
    setDepositInput("0");
    setPendingRental(null);
    setDeliverySignature("");
    showNotice(`${rental.code} registrado. ${equipment.name} quedó marcado como alquilado.`);
  }

  async function returnRental(rental: QuickRental) {
    const extra       = Number(window.prompt("Cargo adicional por días extra, daños o faltantes (COP):", "0") || 0);
    const returnNotes = window.prompt("Estado al recibir / novedades:", "Recibido sin novedades")?.trim();
    if (returnNotes === undefined) return;

    const updates: Partial<QuickRental> = {
      status: "returned", returnedAt: new Date().toISOString(),
      extraCharge: Math.max(0, extra), returnNotes,
    };

    const db = supabase();
    if (db) {
      await db.from("quick_rentals").update({
        status: "returned", returned_at: updates.returnedAt,
        extra_charge: updates.extraCharge, return_notes: returnNotes,
      }).eq("id", rental.id);
    } else {
      // Sin sesion activa: no se confirma la devolucion, se avisa al usuario.
      showNotice("No fue posible registrar la devolucion: inicia sesión en RFC Enterprise para persistirla.");
      return;
    }

    setRentals((prev) => prev.map((r) => r.id === rental.id ? { ...r, ...updates } : r));
    setProducts((prev) => prev.map((p) => p.id === rental.equipmentId ? { ...p, available: p.available + 1 } : p));
    showNotice(`${rental.code} cerrado. El equipo volvió a estar disponible.`);
  }

  return (
    <main className="dashboard-content rentals-workspace" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Custodia comercial · Alquiler rápido</p>
          <h1>Alquiler de equipos</h1>
          <small>Registre entregas rápidas a clientes particulares sin crear una cotización formal.</small>
        </div>
        {!isSupabaseConfigured && (
          <span style={{ fontSize: 12, color: "#f59e0b", background: "#fef3c7", padding: "4px 10px", borderRadius: 6 }}>
            ⚠ Sin Supabase — datos locales
          </span>
        )}
      </section>

      {notice && <p className="rental-notice" role="status" aria-live="polite">{notice}</p>}

      <section className="rentals-grid">
        {/* ── Formulario nuevo alquiler ─────────────────────────────────── */}
        <form ref={rentalFormRef} className="dashboard-panel rental-form" onSubmit={createRental}>
          <div className="panel-title">
            <div><p>Nueva entrega</p><h2>Alquiler rápido</h2></div>
            <span>Requiere cliente, equipo y periodo</span>
          </div>
          <div className="rental-fields">
            <label>Cliente / responsable<input name="customerName" required autoComplete="name" placeholder="Nombre completo" /></label>
            <label>Teléfono
              <input
                name="customerPhone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+57 300 000 00 00"
                pattern="\\+57 [0-9]{3} [0-9]{3} [0-9]{2} [0-9]{2}"
                title="Ingrese un celular colombiano de 10 dígitos."
                onChange={(event) => { event.currentTarget.value = colombianPhone(event.currentTarget.value); }}
              />
            </label>
            <label>Documento<input name="customerDocument" required placeholder="CC o NIT" /></label>
            <label>Equipo disponible
              <select name="equipmentId" required defaultValue="">
                <option value="" disabled>Seleccione equipo…</option>
                {rentable.map((p) => <option value={p.id} key={p.id}>{p.name} · Disp. {p.available}</option>)}
              </select>
            </label>
            <label>Entrega<input name="pickupAt" required type="datetime-local" defaultValue={localDateTime()} /></label>
            <label>Devolución prevista<input name="dueAt" required type="datetime-local" defaultValue={localDateTime(1)} /></label>
            <label>Tarifa por día (COP)
              <input
                name="dailyRate"
                required
                type="text"
                inputMode="numeric"
                placeholder="$ 50.000"
                value={dailyRateInput}
                onChange={(event) => setDailyRateInput(moneyInput(event.currentTarget.value))}
              />
            </label>
            <label>Depósito / garantía (COP)
              <input
                name="deposit"
                type="text"
                inputMode="numeric"
                value={depositInput}
                onChange={(event) => setDepositInput(moneyInput(event.currentTarget.value))}
              />
            </label>
            <label className="rental-wide">Estado inicial y accesorios
              <textarea name="deliveryNotes" rows={2} placeholder="Ej. entregado con cable, llave y estuche; fotos tomadas." />
            </label>
          </div>
          <button className="inventory-action" type="submit">Registrar entrega y bloquear equipo</button>
        </form>

        {/* ── Lista de alquileres ────────────────────────────────────────── */}
        <section className="dashboard-panel rental-list" aria-label="Alquileres registrados">
          <div className="panel-title">
            <div><p>Control de equipos</p><h2>{activeRentals.length} alquileres activos</h2></div>
            <span>{rentable.length} equipos disponibles</span>
          </div>

          {loading ? (
            <p style={{ color: "#6b7280", padding: "1rem 0" }}>Cargando alquileres…</p>
          ) : rentals.length ? (
            <div className="rental-records">
              {rentals.map((rental) => {
                const total = rentalTotal(rental);
                const days  = rentalDays(rental.pickupAt, rental.dueAt);
                return (
                  <article className={`rental-record status-${rental.status}`} key={rental.id}>
                    <div className="rental-record-main">
                      <div className="rental-details">
                      <span className="rental-code">{rental.code}</span>
                      <h3>{rental.equipmentName}</h3>
                      <p><strong>{rental.customerName}</strong> · {rental.customerPhone} · <em>{rental.customerDocument}</em></p>
                      <small>
                        Entrega: {new Date(rental.pickupAt).toLocaleString("es-CO")} · Prevista: {new Date(rental.dueAt).toLocaleString("es-CO")}
                      </small>
                      </div>

                      <div className="rental-amount">
                      <strong>{cop.format(total)}</strong>
                      <small>{days} día(s) · Garantía {cop.format(rental.deposit)}</small>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 6 }}>
                        {/* Factura */}
                        <button type="button" className="btn-cancel" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setInvoicing(rental)}>
                          🧾 Factura
                        </button>
                        {/* Devolución */}
                        {rental.status !== "returned" ? (
                          <button type="button" className="inventory-action" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => returnRental(rental)}>
                            Registrar devolución
                          </button>
                        ) : (
                          <span className="rental-returned">Devuelto</span>
                        )}
                      </div>

                    </div>
                    </div>
                    <AttachmentsPanel rental={rental} />
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">Aún no hay alquileres. Registre una entrega rápida para empezar.</p>
          )}
        </section>
      </section>

      {/* Modal de factura */}
      {invoicing && <InvoiceModal rental={invoicing} onClose={() => setInvoicing(null)} />}

      {pendingRental && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rental-signature-title">
          <div className="modal-card rental-signature-modal">
            <div className="modal-header">
              <div>
                <p>Confirmación de entrega</p>
                <h3 id="rental-signature-title">Firma del cliente</h3>
              </div>
              <button
                className="btn-close-modal"
                type="button"
                aria-label="Cancelar registro de alquiler"
                onClick={() => {
                  setPendingRental(null);
                  setDeliverySignature("");
                }}
              >
                ×
              </button>
            </div>
            <section className="rental-signature-summary" aria-label="Resumen de la entrega">
              <span>Equipo a entregar</span>
              <strong>{pendingRental.equipmentName}</strong>
              <p>{pendingRental.customerName} · {pendingRental.customerDocument}</p>
              <small>Garantía: {cop.format(pendingRental.deposit)} · Devolución prevista: {new Date(pendingRental.dueAt).toLocaleString("es-CO")}</small>
            </section>
            <p className="panel-intro">Antes de bloquear el equipo, solicite al cliente firmar la entrega.</p>
            <SignatureCapture label="Capturar firma del cliente" value={deliverySignature} onChange={setDeliverySignature} />
            <div className="modal-actions">
              <button
                className="btn-cancel"
                type="button"
                onClick={() => {
                  setPendingRental(null);
                  setDeliverySignature("");
                }}
              >
                Modificar
              </button>
              <button
                className="btn-cancel"
                type="button"
                onClick={() => {
                  setPendingRental(null);
                  setDeliverySignature("");
                  rentalFormRef.current?.reset();
                  setDailyRateInput("");
                  setDepositInput("0");
                }}
              >
                Salir
              </button>
              <button className="inventory-action" type="button" disabled={!deliverySignature} onClick={() => void confirmRentalDelivery()}>
                Firmar y aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
