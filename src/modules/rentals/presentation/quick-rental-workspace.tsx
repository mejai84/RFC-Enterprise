"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getInventoryItemKind, inventoryProducts, type StockProduct } from "@/modules/inventory";
import { nextQuickRentalCode, rentalDays, type QuickRental } from "../domain/quick-rental";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const localDateTime = (daysFromNow = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 16);
};

export function QuickRentalWorkspace() {
  const [products, setProducts] = useState<StockProduct[]>(() => {
    if (typeof window === "undefined") return [...inventoryProducts];
    try { return JSON.parse(localStorage.getItem("rfc_inventory_products") || "null") as StockProduct[] || [...inventoryProducts]; } catch { return [...inventoryProducts]; }
  });
  const [rentals, setRentals] = useState<QuickRental[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("rfc_quick_rentals") || "[]") as QuickRental[]; } catch { return []; }
  });
  const [notice, setNotice] = useState("");
  const rentable = useMemo(() => products.filter((product) => product.available > 0 && ["equipment", "tool"].includes(getInventoryItemKind(product))), [products]);
  const activeRentals = rentals.filter((rental) => rental.status !== "returned");

  useEffect(() => { localStorage.setItem("rfc_quick_rentals", JSON.stringify(rentals)); }, [rentals]);
  useEffect(() => { localStorage.setItem("rfc_inventory_products", JSON.stringify(products)); }, [products]);
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(timeout); }, [notice]);

  function createRental(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const equipment = products.find((product) => product.id === data.get("equipmentId"));
    const pickupAt = String(data.get("pickupAt"));
    const dueAt = String(data.get("dueAt"));
    if (!equipment || equipment.available < 1 || !pickupAt || !dueAt || dueAt <= pickupAt) { setNotice("Seleccione un equipo disponible y una devolución posterior a la entrega."); return; }
    const rental: QuickRental = {
      id: crypto.randomUUID(), code: nextQuickRentalCode(rentals), equipmentId: equipment.id, equipmentName: equipment.name,
      customerName: String(data.get("customerName") || "").trim(), customerPhone: String(data.get("customerPhone") || "").trim(), customerDocument: String(data.get("customerDocument") || "").trim(),
      pickupAt, dueAt, dailyRate: Number(data.get("dailyRate")) || 0, deposit: Number(data.get("deposit")) || 0, status: "active", deliveryNotes: String(data.get("deliveryNotes") || "").trim() || undefined,
    };
    setRentals((current) => [rental, ...current]);
    setProducts((current) => current.map((product) => product.id === equipment.id ? { ...product, available: product.available - 1 } : product));
    event.currentTarget.reset();
    setNotice(`${rental.code} registrado. ${equipment.name} quedó marcado como alquilado.`);
  }

  function returnRental(rental: QuickRental) {
    const extra = Number(window.prompt("Cargo adicional por días extra, daños o faltantes (COP):", "0") || 0);
    const returnNotes = window.prompt("Estado al recibir / novedades:", "Recibido sin novedades")?.trim();
    if (returnNotes === undefined) return;
    setRentals((current) => current.map((item) => item.id === rental.id ? { ...item, status: "returned", returnedAt: new Date().toISOString(), extraCharge: Math.max(0, extra), returnNotes } : item));
    setProducts((current) => current.map((product) => product.id === rental.equipmentId ? { ...product, available: product.available + 1 } : product));
    setNotice(`${rental.code} cerrado. El equipo volvió a estar disponible.`);
  }

  return <main className="dashboard-content rentals-workspace" id="main-content">
    <section className="dashboard-heading"><div><p>Custodia comercial · Alquiler rápido</p><h1>Alquiler de equipos</h1><small>Registre entregas rápidas a clientes particulares sin crear una cotización formal.</small></div></section>
    {notice ? <p className="rental-notice" role="status" aria-live="polite">{notice}</p> : null}
    <section className="rentals-grid">
      <form className="dashboard-panel rental-form" onSubmit={createRental}>
        <div className="panel-title"><div><p>Nueva entrega</p><h2>Alquiler rápido</h2></div><span>Requiere cliente, equipo y periodo</span></div>
        <div className="rental-fields">
          <label>Cliente / responsable<input name="customerName" required autoComplete="name" placeholder="Nombre completo" /></label>
          <label>Teléfono<input name="customerPhone" required type="tel" autoComplete="tel" placeholder="300 000 0000" /></label>
          <label>Documento<input name="customerDocument" required placeholder="CC o NIT" /></label>
          <label>Equipo disponible<select name="equipmentId" required defaultValue=""><option value="" disabled>Seleccione equipo…</option>{rentable.map((product) => <option value={product.id} key={product.id}>{product.name} · Disp. {product.available}</option>)}</select></label>
          <label>Entrega<input name="pickupAt" required type="datetime-local" defaultValue={localDateTime()} /></label>
          <label>Devolución prevista<input name="dueAt" required type="datetime-local" defaultValue={localDateTime(1)} /></label>
          <label>Tarifa por día (COP)<input name="dailyRate" required min="0" type="number" inputMode="numeric" placeholder="50000" /></label>
          <label>Depósito / garantía (COP)<input name="deposit" min="0" type="number" inputMode="numeric" defaultValue="0" /></label>
          <label className="rental-wide">Estado inicial y accesorios<textarea name="deliveryNotes" rows={2} placeholder="Ej. entregado con cable, llave y estuche; fotos tomadas." /></label>
        </div>
        <button className="inventory-action" type="submit">Registrar entrega y bloquear equipo</button>
      </form>
      <section className="dashboard-panel rental-list" aria-label="Alquileres registrados">
        <div className="panel-title"><div><p>Control de equipos</p><h2>{activeRentals.length} alquileres activos</h2></div><span>{rentable.length} equipos disponibles</span></div>
        {rentals.length ? <div className="rental-records">{rentals.map((rental) => {
          const days = rentalDays(rental.pickupAt, rental.dueAt); const total = days * rental.dailyRate + (rental.extraCharge ?? 0);
          return <article className={`rental-record status-${rental.status}`} key={rental.id}><div><span className="rental-code">{rental.code}</span><h3>{rental.equipmentName}</h3><p><strong>{rental.customerName}</strong> · {rental.customerPhone}</p><small>Entrega: {new Date(rental.pickupAt).toLocaleString("es-CO")} · Prevista: {new Date(rental.dueAt).toLocaleString("es-CO")}</small></div><div className="rental-amount"><strong>{cop.format(total)}</strong><small>{days} día(s) · Garantía {cop.format(rental.deposit)}</small>{rental.status === "returned" ? <span className="rental-returned">Devuelto</span> : <button type="button" onClick={() => returnRental(rental)}>Registrar devolución</button>}</div></article>;
        })}</div> : <p className="empty-state">Aún no hay alquileres. Registre una entrega rápida para empezar.</p>}
      </section>
    </section>
  </main>;
}
