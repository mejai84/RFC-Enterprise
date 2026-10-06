"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { SearchableProductPicker } from "./searchable-product-picker";
import type { StockProduct } from "../index";
import {
  WRITEOFF_REASONS,
  isWriteoffPending,
  writeoffReasonLabel,
  writeoffStatusLabel,
  type Writeoff,
  type WriteoffReason,
} from "../domain/writeoff";

const formatCOP = (value: number) =>
  value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const formatNumber = (value: number, digits = 3) =>
  value.toLocaleString("es-CO", { maximumFractionDigits: digits });

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const DEFAULT_THRESHOLD = 5_000_000;

type Props = {
  products: StockProduct[];
  scope: { companyId: string; branchId: string } | null;
  notify: (text: string, type: "success" | "error") => void;
  /** Refleja en el catálogo el descuento real de existencias que la base de datos ya aplicó. */
  onStockChanged: (stockId: string, delta: number) => void;
};

type WriteoffRow = {
  id: string;
  code: string;
  branch_id: string;
  stock_id: string;
  item_name: string;
  unit: string;
  reason: WriteoffReason;
  quantity: number;
  unit_cost: number;
  total_value: number;
  available_before: number;
  status: Writeoff["status"];
  requires_approval: boolean;
  evidence_paths: string[] | null;
  notes: string | null;
  requested_by_name: string;
  requested_at: string;
  approved_by_name: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  applied_at: string | null;
};

const emptyForm = {
  productId: "",
  reason: "deterioro" as WriteoffReason,
  quantity: "",
  notes: "",
};

/**
 * Bajas de inventario (INV-008): registrar deterioro, daño, vencimiento o pérdida
 * con evidencia fotográfica. Si el valor supera el umbral de la empresa, la baja
 * queda pendiente de aprobación de un administrador en lugar de descontar existencias.
 */
export function WriteoffsPanel({ products, scope, notify, onStockChanged }: Props) {
  const supabase = useMemo<SupabaseClient | null>(
    () => (isSupabaseConfigured && supabaseUrl && supabasePublishableKey ? createBrowserClient(supabaseUrl, supabasePublishableKey) : null),
    [],
  );

  const [writeoffs, setWriteoffs] = useState<WriteoffRow[]>([]);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [evidence, setEvidence] = useState<{ name: string; path: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rejectionFor, setRejectionFor] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [thresholdDraft, setThresholdDraft] = useState("");
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !scope) {
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("inventory_writeoffs")
      .select("id, code, branch_id, stock_id, item_name, unit, reason, quantity, unit_cost, total_value, available_before, status, requires_approval, evidence_paths, notes, requested_by_name, requested_at, approved_by_name, approved_at, rejection_reason, applied_at")
      .eq("company_id", scope.companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      notify(`No fue posible cargar las bajas: ${error.message}`, "error");
      setIsLoading(false);
      return;
    }
    setWriteoffs((data ?? []) as WriteoffRow[]);

    const { data: policy } = await supabase
      .from("inventory_writeoff_policies")
      .select("approval_threshold")
      .eq("company_id", scope.companyId)
      .maybeSingle();
    if (policy?.approval_threshold !== null && policy?.approval_threshold !== undefined) {
      setThreshold(Number(policy.approval_threshold));
    }
    setIsLoading(false);
  }, [supabase, scope, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProduct = products.find((product) => product.id === form.productId);
  const parsedQuantity = Number(form.quantity.replace(",", "."));
  const estimatedValue = selectedProduct && Number.isFinite(parsedQuantity) && parsedQuantity > 0
    ? Math.round(parsedQuantity * (selectedProduct.unitCost || 0) * 100) / 100
    : 0;
  const exceedsThreshold = estimatedValue > threshold;
  const pendingCount = writeoffs.filter((w) => w.status === "pending_approval").length;
  const appliedTotal = useMemo(
    () => writeoffs.filter((w) => w.status === "applied").reduce((sum, w) => sum + Number(w.total_value), 0),
    [writeoffs],
  );

  async function uploadEvidence(file: File): Promise<void> {
    if (!supabase || !scope) return;
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const folder = crypto.randomUUID();
    const path = `${scope.companyId}/${folder}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("writeoff-evidence").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      notify(`No se pudo adjuntar la evidencia: ${uploadError.message}`, "error");
      return;
    }
    setEvidence((current) => [...current, { name: file.name, path }]);
  }

  async function openEvidence(path: string): Promise<void> {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from("writeoff-evidence").createSignedUrl(path, 120);
    if (error || !data) {
      notify(`No se pudo abrir la evidencia: ${error?.message ?? "sin permisos"}`, "error");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!supabase || !scope) {
      setFormError("No fue posible validar la empresa del usuario. Vuelve a iniciar sesión.");
      return;
    }
    if (!form.productId) {
      setFormError("Selecciona el recurso que se dará de baja.");
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFormError("La cantidad debe ser un número mayor que cero.");
      return;
    }
    if (selectedProduct && parsedQuantity > selectedProduct.available) {
      setFormError(`Solo hay ${formatNumber(selectedProduct.available)} ${selectedProduct.unit} disponibles.`);
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase.rpc("request_inventory_writeoff", {
      target_company: scope.companyId,
      target_branch: scope.branchId,
      target_stock: form.productId,
      writeoff_reason: form.reason,
      writeoff_quantity: parsedQuantity,
      writeoff_notes: form.notes.trim() || null,
      writeoff_evidence: evidence.map((file) => file.path),
    });
    setIsSubmitting(false);

    if (error) {
      setFormError(error.message);
      notify(`No se registró la baja: ${error.message}`, "error");
      return;
    }

    const created = Array.isArray(data) ? data[0] : data;
    const status = String(created?.writeoff_status ?? "");
    notify(
      status === "pending_approval"
        ? `Baja ${created?.writeoff_code ?? ""} registrada. Supera el umbral y requiere aprobación de un administrador.`
        : `Baja ${created?.writeoff_code ?? ""} aplicada al inventario.`,
      "success",
    );
    setForm(emptyForm);
    setEvidence([]);
    setIsFormOpen(false);
    if (status !== "pending_approval") onStockChanged(form.productId, -parsedQuantity);
    await load();
  }

  async function apply(writeoff: WriteoffRow) {
    if (!supabase) return;
    const { error } = await supabase.rpc("apply_inventory_writeoff", { target_writeoff: writeoff.id });
    if (error) {
      notify(`No se pudo aplicar la baja ${writeoff.code}: ${error.message}`, "error");
      return;
    }
    notify(`Baja ${writeoff.code} aplicada: las existencias fueron descontadas.`, "success");
    onStockChanged(writeoff.stock_id, -Number(writeoff.quantity));
    await load();
  }

  async function reject(writeoff: WriteoffRow) {
    if (!supabase) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      notify("Escribe el motivo del rechazo.", "error");
      return;
    }
    const { error } = await supabase.rpc("reject_inventory_writeoff", {
      target_writeoff: writeoff.id,
      reject_reason: reason,
    });
    if (error) {
      notify(`No se pudo rechazar la baja ${writeoff.code}: ${error.message}`, "error");
      return;
    }
    notify(`Baja ${writeoff.code} rechazada.`, "success");
    setRejectionFor(null);
    setRejectionReason("");
    await load();
  }

  async function saveThreshold() {
    if (!supabase || !scope) return;
    const value = Number(thresholdDraft.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      notify("El umbral debe ser un número mayor o igual a cero.", "error");
      return;
    }
    setIsSavingThreshold(true);
    const { error } = await supabase.rpc("set_writeoff_threshold", {
      target_company: scope.companyId,
      new_threshold: value,
    });
    setIsSavingThreshold(false);
    if (error) {
      notify(`No se pudo guardar el umbral: ${error.message}`, "error");
      return;
    }
    setThreshold(value);
    notify(`Umbral de aprobación actualizado a ${formatCOP(value)}.`, "success");
  }

  if (!scope) {
    return <p className="inventory-empty">No fue posible validar la empresa y la sede del usuario.</p>;
  }

  return (
    <section className="writeoffs-panel" aria-label="Bajas de inventario">
      <header className="writeoffs-header">
        <div>
          <h3>Bajas por deterioro, daño o pérdida</h3>
          <p>
            Cada baja deja un asiento auditable en el kardex. Las que superan{' '}
            <strong>{formatCOP(threshold)}</strong> esperan aprobación de un administrador.
          </p>
        </div>
        <button
          type="button"
          className={isFormOpen ? "writeoffs-toggle is-open" : "writeoffs-toggle"}
          onClick={() => {
            setIsFormOpen((open) => !open);
            setFormError(null);
          }}
          aria-expanded={isFormOpen}
          title={isFormOpen ? "Cerrar el formulario de baja" : "Registrar una nueva baja de inventario"}
        >
          {isFormOpen ? "✕ Cerrar" : "➕ Registrar baja"}
        </button>
      </header>

      <dl className="writeoffs-summary">
        <div>
          <dt>Pendientes de aprobación</dt>
          <dd>{pendingCount}</dd>
        </div>
        <div>
          <dt>Bajas aplicadas</dt>
          <dd>{writeoffs.filter((w) => w.status === "applied").length}</dd>
        </div>
        <div>
          <dt>Valor dado de baja</dt>
          <dd>{formatCOP(appliedTotal)}</dd>
        </div>
        <div>
          <dt>Umbral de aprobación</dt>
          <dd>{formatCOP(threshold)}</dd>
        </div>
      </dl>

      {isFormOpen && (
        <form className="writeoffs-form" onSubmit={submit} noValidate>
          <div className="writeoffs-field">
            <span>Recurso a dar de baja *</span>
            <SearchableProductPicker
              products={products.filter((product) => product.available > 0)}
              value={form.productId}
              onChange={(productId) => setForm((current) => ({ ...current, productId }))}
              placeholder="Escribe el nombre o el SKU del recurso…"
              formatDetail={(product) => `Disp: ${formatNumber(product.available)} ${product.unit} · Costo ${formatCOP(product.unitCost ?? 0)}`}
            />
          </div>

          <label className="writeoffs-field">
            <span>Causa *</span>
            <select
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value as WriteoffReason }))}
            >
              {WRITEOFF_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="writeoffs-field">
            <span>Cantidad *</span>
            <input
              inputMode="decimal"
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="0"
              aria-describedby="writeoffs-available-hint"
            />
            <small id="writeoffs-available-hint">
              {selectedProduct
                ? `Disponible: ${formatNumber(selectedProduct.available)} ${selectedProduct.unit}`
                : "Selecciona un recurso para ver la existencia disponible."}
            </small>
          </label>

          <label className="writeoffs-field is-wide">
            <span>Evidencia (fotos del daño)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              multiple
              aria-label="Adjuntar evidencia fotográfica de la baja"
              title="Adjuntar fotos que respalden la baja"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                for (const file of files) void uploadEvidence(file);
              }}
            />
            {evidence.length > 0 ? (
              <small>{evidence.length} archivo(s) adjunto(s) — se vincularán a la baja.</small>
            ) : (
              <small>Opcional, pero recomendable: una foto evita rechazos en la revisión.</small>
            )}
          </label>

          <label className="writeoffs-field is-wide">
            <span>Justificación</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Describe qué ocurrió, quién lo detectó y por qué no es recuperable."
            />
          </label>

          <div className={`writeoffs-estimate ${exceedsThreshold ? "is-over" : ""}`}>
            <span>Valor estimado de la baja</span>
            <strong>{formatCOP(estimatedValue)}</strong>
            {exceedsThreshold ? (
              <small>
                Supera el umbral: la baja quedará <strong>pendiente de aprobación</strong> y no descontará
                existencias hasta que un administrador la autorice.
              </small>
            ) : (
              <small>Dentro del umbral: se aplicará de inmediato al inventario.</small>
            )}
          </div>

          {formError ? (
            <p className="writeoffs-error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="writeoffs-form-actions">
            <button type="submit" disabled={isSubmitting} title="Registrar la baja en la base de datos">
              {isSubmitting ? "Registrando…" : "Registrar baja"}
            </button>
            <button
              type="button"
              className="writeoffs-ghost"
              onClick={() => {
                setForm(emptyForm);
                setEvidence([]);
                setFormError(null);
              }}
              title="Limpiar el formulario de baja"
            >
              Limpiar
            </button>
          </div>
        </form>
      )}

      <div className="writeoffs-threshold">
        <label className="writeoffs-field">
          <span>Cambiar umbral de aprobación</span>
          <input
            inputMode="numeric"
            value={thresholdDraft}
            onChange={(event) => setThresholdDraft(event.target.value)}
            placeholder={formatCOP(threshold)}
            aria-label="Nuevo valor del umbral de aprobación de bajas"
            title="Solo un administrador puede modificar el umbral"
          />
        </label>
        <button
          type="button"
          disabled={isSavingThreshold || thresholdDraft.trim() === ""}
          onClick={() => void saveThreshold()}
          title="Guardar el nuevo umbral de aprobación"
        >
          {isSavingThreshold ? "Guardando…" : "Guardar umbral"}
        </button>
        <small>
          Las bajas por debajo del umbral se aplican solas. Este valor solo lo cambia un administrador.
        </small>
      </div>

      <div className="inventory-table-container">
        {isLoading ? (
          <p className="inventory-empty">Cargando bajas…</p>
        ) : writeoffs.length === 0 ? (
          <p className="inventory-empty">Todavía no se han registrado bajas de inventario.</p>
        ) : (
          <table className="inventory-table">
            <caption className="sr-only">Bajas de inventario registradas</caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Recurso</th>
                <th scope="col">Causa</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Valor</th>
                <th scope="col">Estado</th>
                <th scope="col">Solicitada por</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {writeoffs.map((writeoff) => (
                <tr key={writeoff.id}>
                  <td>
                    <strong>{writeoff.code}</strong>
                    {writeoff.requires_approval ? (
                      <small className="writeoffs-flag">Requiere aprobación</small>
                    ) : null}
                  </td>
                  <td>
                    {writeoff.item_name}
                    <small>
                      Existía: {formatNumber(Number(writeoff.available_before))} {writeoff.unit}
                    </small>
                  </td>
                  <td>
                    {writeoffReasonLabel(writeoff.reason)}
                    {writeoff.notes ? <small>{writeoff.notes}</small> : null}
                  </td>
                  <td>
                    {formatNumber(Number(writeoff.quantity))} {writeoff.unit}
                  </td>
                  <td>{formatCOP(Number(writeoff.total_value))}</td>
                  <td>
                    <span className={`writeoffs-status is-${writeoff.status}`}>
                      {writeoffStatusLabel(writeoff.status)}
                    </span>
                    {writeoff.approved_by_name ? <small>Aprobada por {writeoff.approved_by_name}</small> : null}
                    {writeoff.rejection_reason ? <small>Motivo: {writeoff.rejection_reason}</small> : null}
                  </td>
                  <td>
                    {writeoff.requested_by_name}
                    <small>{formatDateTime(writeoff.requested_at)}</small>
                  </td>
                  <td className="writeoffs-actions">
                    {(writeoff.evidence_paths ?? []).map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => void openEvidence(path)}
                        title="Ver evidencia_adjunta"
                        aria-label={`Ver evidencia de la baja ${writeoff.code}`}
                      >
                        📎
                      </button>
                    ))}
                    {isWriteoffPending(writeoff.status) ? (
                      <button
                        type="button"
                        onClick={() => void apply(writeoff)}
                        title={`Aplicar la baja ${writeoff.code} al inventario`}
                        aria-label={`Aplicar la baja ${writeoff.code}`}
                      >
                        Aplicar
                      </button>
                    ) : null}
                    {writeoff.status === "pending_approval" ? (
                      <button
                        type="button"
                        className="writeoffs-ghost"
                        onClick={() => {
                          setRejectionFor(rejectionFor === writeoff.id ? null : writeoff.id);
                          setRejectionReason("");
                        }}
                        title={`Rechazar la baja ${writeoff.code}`}
                        aria-label={`Rechazar la baja ${writeoff.code}`}
                      >
                        Rechazar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rejectionFor ? (
                <tr className="writeoffs-rejection-row">
                  <td colSpan={8}>
                    <label className="writeoffs-field is-wide">
                      <span>Motivo del rechazo</span>
                      <input
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder="Explica por qué no se acepta la baja."
                        aria-label="Motivo del rechazo de la baja"
                        title="Motivo del rechazo"
                      />
                    </label>
                    <div className="writeoffs-form-actions">
                      <button
                        type="button"
                        onClick={() => {
                          const target = writeoffs.find((w) => w.id === rejectionFor);
                          if (target) void reject(target);
                        }}
                        title="Confirmar el rechazo de la baja"
                      >
                        Confirmar rechazo
                      </button>
                      <button type="button" className="writeoffs-ghost" onClick={() => setRejectionFor(null)} title="Cancelar el rechazo">
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
