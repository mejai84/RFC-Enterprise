"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignatureCapture } from "@/shared/components/signature-capture";
import {
  createQuickRentalOrder,
  getQuickRentalSignatureUrl,
  loadRentalWorkspace,
  returnQuickRentalLine,
} from "../data/quick-rental-order-repository";
import {
  quickRentalDays,
  quickRentalDisplayStatus,
  quickRentalLineIsReturned,
  quickRentalLinePending,
  quickRentalLineSubtotal,
  quickRentalOrderDepositTotal,
  quickRentalOrderPendingQuantity,
  quickRentalOrderRentTotal,
  quickRentalStatusLabels,
  type QuickRentalOrder,
  type QuickRentalOrderLine,
  type RentableEquipment,
} from "../domain/quick-rental-order";

type CartLine = {
  key: string;
  itemId: string;
  name: string;
  quantity: number;
  dailyRate: number;
  deposit: number;
};

type PendingDelivery = {
  customerName: string;
  customerPhone: string;
  customerDocument: string;
  pickupAt: string;
  dueAt: string;
  deliveryNotes: string;
};

type ReturningLine = {
  order: QuickRentalOrder;
  line: QuickRentalOrderLine;
};

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function localDateTimeInput(daysFromNow = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function asNumber(value: string): number {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Documento de alquiler rápido con varias líneas.
 *
 * El flujo activo no guarda equipos, tarifas ni firmas en localStorage: la
 * disponibilidad se calcula contra inventory_stock y los documentos activos
 * de Supabase. Una sola firma cubre la entrega y cada línea conserva su
 * propia devolución parcial.
 */
export function MultiRentalOrderWorkspace() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [equipment, setEquipment] = useState<RentableEquipment[]>([]);
  const [orders, setOrders] = useState<QuickRentalOrder[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notice, setNotice] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [rate, setRate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [pending, setPending] = useState<PendingDelivery | null>(null);
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [returning, setReturning] = useState<ReturningLine | null>(null);
  const [returnQuantity, setReturnQuantity] = useState("1");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnExtra, setReturnExtra] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [invoice, setInvoice] = useState<QuickRentalOrder | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const [defaults] = useState(() => ({
    pickup: localDateTimeInput(0),
    due: localDateTimeInput(1),
  }));
  const formRef = useRef<HTMLFormElement>(null);
  const signatureRequest = useRef(0);

  const reload = useCallback(async () => {
    const data = await loadRentalWorkspace();
    if (!data) {
      setCompanyId("");
      setEquipment([]);
      setOrders([]);
      setLoadError("Inicia sesión en RFC Enterprise para consultar la bodega y los alquileres.");
      return;
    }
    setCompanyId(data.companyId);
    setEquipment(data.equipment);
    setOrders(data.orders);
    setLoadError("");
  }, []);

  useEffect(() => {
    let active = true;
    loadRentalWorkspace()
      .then((data) => {
        if (!active) return;
        if (!data) {
          setLoadError("Inicia sesión en RFC Enterprise para consultar la bodega y los alquileres.");
          return;
        }
        setCompanyId(data.companyId);
        setEquipment(data.equipment);
        setOrders(data.orders);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "No fue posible cargar la bodega.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedEquipment = useMemo(
    () => equipment.find((item) => item.itemId === selectedItemId),
    [equipment, selectedItemId],
  );

  const cartDeposits = useMemo(
    () => cart.reduce((total, line) => total + line.deposit * line.quantity, 0),
    [cart],
  );

  const cartUnits = useMemo(
    () => cart.reduce((total, line) => total + line.quantity, 0),
    [cart],
  );

  function addToCart() {
    if (!selectedEquipment) {
      setNotice("Selecciona un equipo de la bodega.");
      return;
    }
    if (cart.some((line) => line.itemId === selectedEquipment.itemId)) {
      setNotice("Ese equipo ya está en el documento. Ajusta su cantidad o quítalo antes de volver a agregarlo.");
      return;
    }
    const requested = Math.max(1, Math.floor(asNumber(quantity)));
    if (requested > selectedEquipment.available) {
      setNotice(
        `${selectedEquipment.name}: solo hay ${selectedEquipment.available} disponible(s) para entregar.`,
      );
      return;
    }
    setCart((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        itemId: selectedEquipment.itemId,
        name: selectedEquipment.name,
        quantity: requested,
        dailyRate: Math.max(0, asNumber(rate)),
        deposit: Math.max(0, asNumber(deposit)),
      },
    ]);
    setSelectedItemId("");
    setQuantity("1");
    setRate("");
    setDeposit("");
    setNotice("");
  }

  function updateCartQuantity(key: string, nextQuantity: number) {
    setCart((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const available = equipment.find((item) => item.itemId === line.itemId)?.available ?? line.quantity;
        return {
          ...line,
          quantity: Math.min(Math.max(1, Math.floor(nextQuantity)), Math.max(1, available)),
        };
      }),
    );
  }

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const customerName = String(data.get("customer") ?? "").trim();
    const customerDocument = String(data.get("document") ?? "").trim();
    const pickupValue = String(data.get("pickup") ?? "");
    const dueValue = String(data.get("due") ?? "");

    if (customerName.length < 2) {
      setNotice("Escribe el nombre del cliente.");
      return;
    }
    if (!customerDocument) {
      setNotice("El documento del cliente es obligatorio para la entrega.");
      return;
    }
    if (!pickupValue || !dueValue) {
      setNotice("Indica la fecha de entrega y la devolución prevista.");
      return;
    }
    if (new Date(dueValue).getTime() <= new Date(pickupValue).getTime()) {
      setNotice("La devolución prevista debe ser posterior a la entrega.");
      return;
    }
    if (!cart.length) {
      setNotice("Agrega al menos un equipo al documento.");
      return;
    }

    setPending({
      customerName,
      customerPhone: String(data.get("phone") ?? "").trim(),
      customerDocument,
      pickupAt: new Date(pickupValue).toISOString(),
      dueAt: new Date(dueValue).toISOString(),
      deliveryNotes: String(data.get("notes") ?? "").trim(),
    });
    setSignature("");
    setNotice("");
  }

  async function save() {
    if (!pending || !signature || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const result = await createQuickRentalOrder({
        ...pending,
        lines: cart.map((line) => ({
          inventoryItemId: line.itemId,
          equipmentName: line.name,
          quantity: line.quantity,
          dailyRate: line.dailyRate,
          deposit: line.deposit,
        })),
        signatureDataUrl: signature,
      });
      setPending(null);
      setSignature("");
      setCart([]);
      setSelectedItemId("");
      setQuantity("1");
      setRate("");
      setDeposit("");
      formRef.current?.reset();
      // El documento ya quedó creado; si falla el refresco, no se debe mostrar
      // como un fallo de la entrega.
      await reload().catch(() => undefined);
      setNotice(
        result.signatureWarning
          ? `${result.code} quedó registrado, pero la firma no se pudo guardar: ${result.signatureWarning}`
          : `${result.code} registrado con una sola firma de entrega.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible registrar el alquiler.");
      await reload().catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  function openReturn(order: QuickRentalOrder, line: QuickRentalOrderLine) {
    setReturning({ order, line });
    setReturnQuantity("1");
    setReturnNotes("");
    setReturnExtra("");
    setNotice("");
  }

  async function submitReturn() {
    if (!returning || returnSaving) return;
    const pendingQuantity = quickRentalLinePending(returning.line);
    const requestedQuantity = Math.floor(asNumber(returnQuantity));
    if (requestedQuantity < 1) {
      setNotice("Indica cuántas unidades se reciben.");
      return;
    }
    if (requestedQuantity > pendingQuantity) {
      setNotice(`Solo quedan ${pendingQuantity} unidad(es) pendientes de esa línea.`);
      return;
    }
    if (returnNotes.trim().length < 3) {
      setNotice("Describe el estado en que se recibe el equipo.");
      return;
    }

    setReturnSaving(true);
    try {
      await returnQuickRentalLine({
        orderId: returning.order.id,
        lineId: returning.line.id,
        quantity: requestedQuantity,
        notes: returnNotes,
        extraCharge: Math.max(0, asNumber(returnExtra)),
      });
      setReturning(null);
      await reload().catch(() => undefined);
      setNotice("Devolución registrada. El estado del documento se actualizó.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible registrar la devolución.");
    } finally {
      setReturnSaving(false);
    }
  }

  async function openInvoice(order: QuickRentalOrder) {
    const request = signatureRequest.current + 1;
    signatureRequest.current = request;
    setInvoice(order);
    setSignatureUrl(null);
    if (!order.signaturePath) return;
    try {
      const url = await getQuickRentalSignatureUrl(order.signaturePath);
      if (signatureRequest.current === request) setSignatureUrl(url);
    } catch {
      if (signatureRequest.current === request) setSignatureUrl(null);
    }
  }

  const pendingDays = pending ? quickRentalDays(pending.pickupAt, pending.dueAt) : 1;
  const pendingRent = pending
    ? cart.reduce(
        (total, line) => total + line.quantity * pendingDays * line.dailyRate,
        0,
      )
    : 0;

  return (
    <main className="dashboard-content rentals-workspace" id="main-content">
      <section className="dashboard-heading">
        <div>
          <p>Custodia comercial · Alquiler rápido</p>
          <h1>Documento de alquiler</h1>
          <small>
            Varias líneas, una sola firma de entrega y devoluciones parciales por equipo.
            La disponibilidad se consulta en la bodega persistida.
          </small>
        </div>
      </section>

      {notice ? (
        <p className="rental-notice" role="status">
          {notice}
        </p>
      ) : null}
      {loadError ? (
        <p className="rental-notice" role="alert" style={{ background: "#fdecec", borderColor: "#e7a6a6", color: "#8a1f1f" }}>
          {loadError}
        </p>
      ) : null}

      <section className="rentals-grid">
        <form className="dashboard-panel rental-form" onSubmit={prepare} ref={formRef}>
          <div className="panel-title">
            <div>
              <p>Nueva entrega</p>
              <h2>Cliente y periodo</h2>
            </div>
            <span>{loading ? "Cargando bodega…" : `${equipment.length} referencias`}</span>
          </div>

          <div className="rental-fields">
            <label>
              Cliente / responsable
              <input name="customer" required autoComplete="name" />
            </label>
            <label>
              Teléfono
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
            <label>
              Documento
              <input name="document" required autoComplete="off" />
            </label>
            <label>
              Entrega
              <input name="pickup" required type="datetime-local" defaultValue={defaults.pickup} />
            </label>
            <label>
              Devolución prevista
              <input name="due" required type="datetime-local" defaultValue={defaults.due} />
            </label>
            <label className="rental-wide">
              Estado inicial y accesorios
              <textarea name="notes" rows={2} placeholder="Ej.: se entrega con maletín, cadena y batería al 80 %." />
            </label>
          </div>

          <div className="panel-title">
            <div>
              <p>Equipos</p>
              <h2>Agregar al documento</h2>
            </div>
            <span>{cartUnits} unidad(es) en {cart.length} línea(s)</span>
          </div>

          <div className="rental-fields">
            <label className="rental-wide">
              Equipo o herramienta disponible
              <select
                value={selectedItemId}
                onChange={(event) => {
                  setSelectedItemId(event.target.value);
                  setQuantity("1");
                }}
              >
                <option value="">Selecciona un equipo…</option>
                {equipment.map((item) => (
                  <option key={item.itemId} value={item.itemId} disabled={item.available <= 0}>
                    {item.name} · {item.available} disponible(s) de {item.stock} · {item.inventoryGroupName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad
              <input
                min={1}
                max={selectedEquipment?.available ?? undefined}
                step={1}
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <label>
              Tarifa diaria (COP)
              <input min={0} step={1} type="number" value={rate} onChange={(event) => setRate(event.target.value)} />
            </label>
            <label>
              Garantía por unidad (COP)
              <input min={0} step={1} type="number" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button className="inventory-action" onClick={addToCart} type="button">
                Agregar equipo
              </button>
            </div>
          </div>

          {selectedEquipment ? (
            <p className="panel-intro" style={{ marginBottom: 10 }}>
              {selectedEquipment.category} · {selectedEquipment.stock} en bodega ·{" "}
              {selectedEquipment.rented} fuera de bodega ·{" "}
              <strong>{selectedEquipment.available} disponible(s)</strong>
            </p>
          ) : null}
          {!loading && equipment.length === 0 ? (
            <p className="panel-intro">
              No hay equipos ni herramientas con existencia en la bodega. Revisa el
              inventario o la clasificación de la categoría antes de crear una entrega.
            </p>
          ) : null}

          <ul className="rental-records" aria-label="Equipos del documento">
            {cart.length === 0 ? (
              <li className="empty-state">Aún no has agregado equipos. La entrega puede tener varias líneas.</li>
            ) : (
              cart.map((line) => (
                <li className="rental-record" key={line.key}>
                  <div className="rental-record-main">
                    <div className="rental-details">
                      <strong>{line.name}</strong>
                      <p>
                        {cop.format(line.dailyRate)} / día · Garantía {cop.format(line.deposit)} por unidad
                      </p>
                    </div>
                    <div className="rental-amount">
                      <label style={{ alignItems: "center", display: "flex", gap: 6, fontSize: 12 }}>
                        Cantidad
                        <input
                          aria-label={`Cantidad de ${line.name}`}
                          max={equipment.find((item) => item.itemId === line.itemId)?.available ?? line.quantity}
                          min={1}
                          onChange={(event) => updateCartQuantity(line.key, asNumber(event.target.value))}
                          style={{ maxWidth: 72, minHeight: 34, padding: "4px 6px" }}
                          type="number"
                          value={line.quantity}
                        />
                      </label>
                      <button
                        className="btn-cancel"
                        onClick={() => setCart((current) => current.filter((item) => item.key !== line.key))}
                        type="button"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>

          <p className="panel-intro" style={{ margin: "12px 0" }}>
            Garantías del documento: <strong>{cop.format(cartDeposits)}</strong>. La renta se calcula por
            línea según los días del periodo.
          </p>
          <button className="inventory-action" disabled={!cart.length || loading} type="submit">
            Continuar a firma única
          </button>
        </form>

        <section className="dashboard-panel rental-list">
          <div className="panel-title">
            <div>
              <p>Documentos recientes</p>
              <h2>{orders.length} alquiler(es)</h2>
            </div>
            <span>{companyId ? "Datos de Supabase" : "Sin empresa activa"}</span>
          </div>

          {orders.length === 0 ? (
            <p className="empty-state">No hay documentos de alquiler registrados.</p>
          ) : (
            <div className="rental-records">
              {orders.map((order) => {
                const status = quickRentalDisplayStatus(order, now);
                const pendingUnits = quickRentalOrderPendingQuantity(order);
                return (
                  <article
                    className={`rental-record${status === "returned" ? " status-returned" : ""}`}
                    key={order.id}
                  >
                    <div className="rental-record-main">
                      <div className="rental-details">
                        <span className="rental-code">{order.code}</span>
                        <h3>{order.customerName}</h3>
                        <p>
                          {order.lines.length} línea(s) · {pendingUnits} unidad(es) pendiente(s) ·{" "}
                          <strong>{quickRentalStatusLabels[status]}</strong>
                        </p>
                        <small>
                          {dateTime(order.pickupAt)} → {dateTime(order.dueAt)}
                        </small>
                      </div>
                      <div className="rental-amount">
                        <strong>{cop.format(quickRentalOrderRentTotal(order))}</strong>
                        <small>Garantía {cop.format(quickRentalOrderDepositTotal(order))}</small>
                        <button onClick={() => void openInvoice(order)} type="button">
                          Ver factura
                        </button>
                      </div>
                    </div>

                    <ul className="rental-records" style={{ marginTop: 10 }}>
                      {order.lines.map((line) => {
                        const linePending = quickRentalLinePending(line);
                        return (
                          <li className="rental-record" key={line.id}>
                            <div className="rental-record-main">
                              <div className="rental-details">
                                <strong>{line.equipmentName}</strong>
                                <p>
                                  {line.quantity} × {cop.format(line.dailyRate)} / día · Garantía{" "}
                                  {cop.format(line.deposit)} / unidad
                                </p>
                                {line.returnedQuantity > 0 ? (
                                  <p>
                                    Devuelto {line.returnedQuantity}/{line.quantity}
                                    {line.returnNotes ? ` · ${line.returnNotes}` : ""}
                                  </p>
                                ) : null}
                              </div>
                              <div className="rental-amount">
                                {quickRentalLineIsReturned(line) ? (
                                  <span className="rental-returned">Devuelto</span>
                                ) : (
                                  <button
                                    className="inventory-action"
                                    onClick={() => openReturn(order, line)}
                                    type="button"
                                  >
                                    Devolver {linePending}
                                  </button>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {pending ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Firma del cliente">
          <div className="modal-card rental-signature-modal">
            <h3>Firma del cliente</h3>
            <div className="rental-signature-summary">
              <span>Entrega consolidada</span>
              <strong>{pending.customerName}</strong>
              <p>
                {cart.length} línea(s) · {cartUnits} unidad(es) · {pendingDays} día(s)
              </p>
              <p>
                Renta estimada {cop.format(pendingRent)} · Garantías {cop.format(cartDeposits)}
              </p>
              <small>
                {dateTime(pending.pickupAt)} → {dateTime(pending.dueAt)}
              </small>
            </div>
            <SignatureCapture label="Capturar firma" value={signature} onChange={setSignature} />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setPending(null)} type="button">
                Volver
              </button>
              <button className="inventory-action" disabled={!signature || saving} onClick={() => void save()} type="button">
                {saving ? "Guardando…" : "Firmar y registrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {returning ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Registrar devolución">
          <div className="modal-card rental-signature-modal">
            <h3>Devolución parcial</h3>
            <div className="rental-signature-summary">
              <span>{returning.order.code}</span>
              <strong>{returning.line.equipmentName}</strong>
              <p>
                Pendiente: {quickRentalLinePending(returning.line)} de {returning.line.quantity} unidad(es)
              </p>
            </div>
            <div className="rental-fields">
              <label>
                Unidades que se reciben
                <input
                  min={1}
                  max={quickRentalLinePending(returning.line)}
                  onChange={(event) => setReturnQuantity(event.target.value)}
                  step={1}
                  type="number"
                  value={returnQuantity}
                />
              </label>
              <label>
                Recargo por daño o demora (COP)
                <input
                  min={0}
                  onChange={(event) => setReturnExtra(event.target.value)}
                  step={1}
                  type="number"
                  value={returnExtra}
                />
              </label>
              <label className="rental-wide">
                Estado en que se recibe
                <textarea
                  onChange={(event) => setReturnNotes(event.target.value)}
                  placeholder="Ej.: equipo completo, con desgaste normal; sin accesorios faltantes."
                  required
                  rows={3}
                  value={returnNotes}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setReturning(null)} type="button">
                Cancelar
              </button>
              <button className="inventory-action" disabled={returnSaving} onClick={() => void submitReturn()} type="button">
                {returnSaving ? "Guardando…" : "Registrar devolución"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {invoice ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Factura de alquiler">
          <div className="modal-card rental-invoice-modal">
            <div className="modal-header">
              <div>
                <p>Factura de alquiler</p>
                <h3>{invoice.code}</h3>
              </div>
            </div>
            <p>
              {invoice.customerName}
              {invoice.customerDocument ? ` · ${invoice.customerDocument}` : ""}
              {invoice.customerPhone ? ` · ${invoice.customerPhone}` : ""}
            </p>
            <p>
              {dateTime(invoice.pickupAt)} → {dateTime(invoice.dueAt)} ·{" "}
              {quickRentalDays(invoice.pickupAt, invoice.dueAt)} día(s)
            </p>

            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Cant.</th>
                    <th>Días</th>
                    <th>Tarifa</th>
                    <th>Recargo</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        {line.equipmentName}
                        {line.returnedQuantity > 0 ? (
                          <small style={{ display: "block", color: "#64748b" }}>
                            Devuelto {line.returnedQuantity}/{line.quantity}
                          </small>
                        ) : null}
                      </td>
                      <td>{line.quantity}</td>
                      <td>{quickRentalDays(invoice.pickupAt, invoice.dueAt)}</td>
                      <td>{cop.format(line.dailyRate)}</td>
                      <td>{cop.format(line.extraCharge)}</td>
                      <td>
                        {cop.format(
                          quickRentalLineSubtotal(
                            line,
                            quickRentalDays(invoice.pickupAt, invoice.dueAt),
                          ),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "grid", gap: 4, marginTop: 14 }}>
              <p>
                <strong>Renta: {cop.format(quickRentalOrderRentTotal(invoice))}</strong>
              </p>
              <p>Garantía del documento: {cop.format(quickRentalOrderDepositTotal(invoice))}</p>
              {invoice.deliveryNotes ? <p>Observaciones: {invoice.deliveryNotes}</p> : null}
            </div>

            <div className="rental-attachments">
              <h4 style={{ marginBottom: "0.5rem", fontSize: 13, color: "#6b7280" }}>
                Firma de entrega
              </h4>
              {signatureUrl ? (
                // La firma vive en un bucket privado; se muestra con URL temporal.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Firma del cliente"
                  src={signatureUrl}
                  style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, maxWidth: "100%" }}
                />
              ) : (
                <p className="panel-intro">
                  {invoice.signaturePath
                    ? "No fue posible generar la vista temporal de la firma."
                    : "Este documento no tiene firma adjunta."}
                </p>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  signatureRequest.current += 1;
                  setSignatureUrl(null);
                  setInvoice(null);
                }}
                type="button"
              >
                Cerrar
              </button>
              <button className="inventory-action" onClick={() => window.print()} type="button">
                Imprimir factura
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
