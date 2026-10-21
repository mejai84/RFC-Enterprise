/* ─────────────────────────────────────────────────────────────
 * Módulo Alquiler rápido – Repositorio Supabase
 *
 * Fuente de verdad: public.quick_rental_orders,
 * public.quick_rental_order_items y public.quick_rental_order_attachments.
 * La disponibilidad se calcula contra inventory_stock e inventory_items y
 * descuenta las líneas activas de otros documentos. No usa localStorage ni
 * catálogos semilla del navegador.
 * ───────────────────────────────────────────────────────────── */

import { createBrowserClient } from "@supabase/ssr";
import { dataUrlToBlob } from "@/shared/utils/data-url";
import { getInventoryItemKind, type InventoryGroup } from "@/modules/inventory";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { loadAllPages } from "@/shared/supabase/load-all";
import {
  type CreateQuickRentalOrderInput,
  type CreateQuickRentalOrderResult,
  type QuickRentalOrder,
  type QuickRentalOrderLine,
  type QuickRentalOrderStatus,
  type RentableEquipment,
  type ReturnQuickRentalLineInput,
} from "../domain/quick-rental-order";

const groupNames: Record<string, string> = {
  bodega: "Bodega",
  dotacion: "Dotación",
  trabajadores: "Trabajadores",
};

const rentalStatuses: QuickRentalOrderStatus[] = [
  "active",
  "partially_returned",
  "returned",
  "overdue",
];

type RentalContext = { companyId: string; branchId: string | null };

function client() {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) return null;
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}

async function resolveContext(
  db: NonNullable<ReturnType<typeof client>>,
): Promise<RentalContext | null> {
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;

  const { data: membership, error: membershipError } = await db
    .from("user_roles")
    .select("company_id, branch_id")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.company_id) return null;

  return {
    companyId: membership.company_id,
    branchId: membership.branch_id ?? null,
  };
}

function mapLine(row: Record<string, unknown>): QuickRentalOrderLine {
  return {
    id: String(row.id),
    inventoryItemId: row.inventory_item_id ? String(row.inventory_item_id) : null,
    equipmentName: String(row.equipment_name ?? "Equipo"),
    quantity: Number(row.quantity ?? 0),
    dailyRate: Number(row.daily_rate ?? 0),
    deposit: Number(row.deposit ?? 0),
    returnedQuantity: Number(row.returned_quantity ?? 0),
    returnedAt: row.returned_at ? String(row.returned_at) : undefined,
    returnNotes: row.return_notes ? String(row.return_notes) : undefined,
    extraCharge: Number(row.extra_charge ?? 0),
  };
}

function mapOrder(row: Record<string, unknown>): QuickRentalOrder {
  const items = Array.isArray(row.quick_rental_order_items)
    ? (row.quick_rental_order_items as Array<Record<string, unknown>>)
    : [];
  const attachments = Array.isArray(row.quick_rental_order_attachments)
    ? (row.quick_rental_order_attachments as Array<Record<string, unknown>>)
    : [];
  const signature = attachments.find((attachment) => attachment.kind === "signature");
  const status = String(row.status ?? "active") as QuickRentalOrderStatus;

  return {
    id: String(row.id),
    code: String(row.code),
    customerName: String(row.customer_name ?? ""),
    customerPhone: row.customer_phone ? String(row.customer_phone) : undefined,
    customerDocument: row.customer_document ? String(row.customer_document) : undefined,
    pickupAt: String(row.pickup_at),
    dueAt: String(row.due_at),
    status: rentalStatuses.includes(status) ? status : "active",
    deliveryNotes: row.delivery_notes ? String(row.delivery_notes) : undefined,
    lines: items.map(mapLine),
    signaturePath: signature?.storage_path ? String(signature.storage_path) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

/** Documentos de alquiler de la empresa, con sus líneas y firma. */
export async function listQuickRentalOrders(companyId?: string): Promise<QuickRentalOrder[]> {
  const db = client();
  if (!db) return [];

  const context = companyId ? { companyId } : await resolveContext(db);
  if (!context) return [];

  const { data, error } = await loadAllPages((from, to) =>
    db
      .from("quick_rental_orders")
      .select(
        "id,code,customer_name,customer_phone,customer_document,pickup_at,due_at,status,delivery_notes,created_at,quick_rental_order_items(id,inventory_item_id,equipment_name,quantity,daily_rate,deposit,returned_quantity,returned_at,return_notes,extra_charge),quick_rental_order_attachments(kind,storage_path,file_name,mime_type,uploaded_at)",
      )
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  if (error) throw new Error(`No fue posible cargar los alquileres: ${error.message}`);
  return data.map((row) => mapOrder(row as Record<string, unknown>));
}

/**
 * Equipos y herramientas con existencia persistida, menos lo que ya está
 * fuera de bodega en documentos activos o parcialmente devueltos.
 */
export async function listRentableEquipment(companyId: string): Promise<RentableEquipment[]> {
  const db = client();
  if (!db) return [];

  const { data: stockRows, error: stockError } = await loadAllPages((from, to) =>
    db
      .from("inventory_stock")
      .select("id,quantity,inventory_group,inventory_items!inner(id,name,category,unit)")
      .eq("company_id", companyId)
      .order("id")
      .range(from, to),
  );
  if (stockError) throw new Error(`No fue posible consultar la bodega: ${stockError.message}`);

  const { data: activeOrders, error: ordersError } = await db
    .from("quick_rental_orders")
    .select("id")
    .eq("company_id", companyId)
    .in("status", ["active", "partially_returned", "overdue"]);
  if (ordersError) throw new Error(`No fue posible consultar los alquileres activos: ${ordersError.message}`);

  const orderIds = (activeOrders ?? []).map((order) => order.id);
  const rentedByItem = new Map<string, number>();
  if (orderIds.length) {
    const { data: activeLines, error: linesError } = await db
      .from("quick_rental_order_items")
      .select("inventory_item_id,quantity,returned_quantity")
      .in("order_id", orderIds);
    if (linesError) throw new Error(`No fue posible calcular la disponibilidad: ${linesError.message}`);
    for (const line of activeLines ?? []) {
      if (!line.inventory_item_id) continue;
      const pending = Math.max(0, Number(line.quantity) - Number(line.returned_quantity));
      rentedByItem.set(
        line.inventory_item_id,
        (rentedByItem.get(line.inventory_item_id) ?? 0) + pending,
      );
    }
  }

  const byItem = new Map<string, RentableEquipment>();
  for (const stock of stockRows) {
    const item = Array.isArray(stock.inventory_items)
      ? stock.inventory_items[0]
      : stock.inventory_items;
    if (!item) continue;

    const inventoryGroup = String(stock.inventory_group) as InventoryGroup;
    // El alquiler sale de bodega. La clasificación del módulo de Inventarios
    // reconoce equipos y herramientas; además se aceptan categorías explícitas
    // de equipo/maquinaria/alquiler para no depender solo del nombre.
    if (inventoryGroup !== "bodega") continue;
    const kind = getInventoryItemKind({
      inventoryGroup,
      category: item.category ?? "",
      name: item.name,
    });
    const categoryText = String(item.category ?? "").toLocaleLowerCase("es-CO");
    const searchText = `${categoryText} ${item.name.toLocaleLowerCase("es-CO")}`;
    if (/consumible|electrodo|disco de corte|lija|broca|tornill|clavo|remache/.test(searchText)) continue;
    const rentableByCategory = /equipo|maquinaria|herramient|alquiler/.test(categoryText);
    if (kind !== "equipment" && kind !== "tool" && !rentableByCategory) continue;

    const current = byItem.get(item.id);
    const quantity = Number(stock.quantity ?? 0);
    if (quantity <= 0 && !current) continue;
    if (current) {
      current.stock += quantity;
      continue;
    }
    byItem.set(item.id, {
      itemId: item.id,
      name: item.name,
      category: item.category ?? "Sin categoría",
      unit: item.unit ?? "unidad",
      inventoryGroup,
      inventoryGroupName: groupNames[inventoryGroup] ?? inventoryGroup,
      stock: quantity,
      rented: 0,
      available: 0,
      unitCost: 0,
    });
  }

  for (const [itemId, entry] of byItem) {
    const rented = rentedByItem.get(itemId) ?? 0;
    entry.rented = rented;
    entry.available = Math.max(0, entry.stock - rented);
  }

  return [...byItem.values()].sort((a, b) => a.name.localeCompare(b.name, "es-CO"));
}

/** Contexto, documentos y equipos en una sola carga para la pantalla. */
export async function loadRentalWorkspace(): Promise<{
  companyId: string;
  branchId: string | null;
  orders: QuickRentalOrder[];
  equipment: RentableEquipment[];
} | null> {
  const db = client();
  if (!db) return null;
  const context = await resolveContext(db);
  if (!context) return null;

  const [orders, equipment] = await Promise.all([
    listQuickRentalOrders(context.companyId),
    listRentableEquipment(context.companyId),
  ]);
  return { ...context, orders, equipment };
}

function generateCodeBase(date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `ALQ-RAP-${day}`;
}

/**
 * Crea la cabecera, las líneas y la firma. La disponibilidad se vuelve a
 * consultar justo antes de escribir para no aceptar un equipo ya entregado.
 */
export async function createQuickRentalOrder(
  input: CreateQuickRentalOrderInput,
): Promise<CreateQuickRentalOrderResult> {
  const db = client();
  if (!db) throw new Error("Supabase no está configurado: el alquiler no se puede persistir.");
  const context = await resolveContext(db);
  if (!context) throw new Error("Inicia sesión para registrar el alquiler.");

  const customerName = input.customerName.trim();
  if (customerName.length < 2) throw new Error("Escribe el nombre del cliente.");
  if (!input.pickupAt || !input.dueAt) throw new Error("Indica la entrega y la devolución prevista.");
  if (new Date(input.dueAt).getTime() <= new Date(input.pickupAt).getTime()) {
    throw new Error("La devolución prevista debe ser posterior a la entrega.");
  }
  if (!input.lines.length) throw new Error("Agrega al menos un equipo al documento.");
  if (!input.signatureDataUrl) throw new Error("La firma del cliente es obligatoria.");

  const equipment = await listRentableEquipment(context.companyId);
  const byItem = new Map(equipment.map((entry) => [entry.itemId, entry]));
  const requestedByItem = new Map<string, number>();
  for (const line of input.lines) {
    if (!line.inventoryItemId) throw new Error("Una de las líneas no tiene equipo asociado.");
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error(`La cantidad de ${line.equipmentName} debe ser mayor que cero.`);
    }
    if (
      !Number.isFinite(line.dailyRate) ||
      !Number.isFinite(line.deposit) ||
      line.dailyRate < 0 ||
      line.deposit < 0
    ) {
      throw new Error(`La tarifa y la garantía de ${line.equipmentName} no pueden ser negativas.`);
    }
    const item = byItem.get(line.inventoryItemId);
    if (!item) throw new Error(`${line.equipmentName} ya no está disponible en la bodega.`);
    const requested = (requestedByItem.get(line.inventoryItemId) ?? 0) + line.quantity;
    requestedByItem.set(line.inventoryItemId, requested);
    if (requested > item.available) {
      throw new Error(
        `${item.name}: solicitas ${requested} y solo hay ${item.available} disponible(s).`,
      );
    }
  }

  const base = generateCodeBase();
  let headerId = "";
  let code = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { count } = await db
      .from("quick_rental_orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", context.companyId)
      .like("code", `${base}-%`);
    code = `${base}-${String((count ?? 0) + 1 + attempt).padStart(3, "0")}`;

    const { data, error } = await db
      .from("quick_rental_orders")
      .insert({
        company_id: context.companyId,
        branch_id: context.branchId,
        code,
        customer_name: customerName,
        customer_phone: input.customerPhone?.trim() || null,
        customer_document: input.customerDocument?.trim() || null,
        pickup_at: input.pickupAt,
        due_at: input.dueAt,
        delivery_notes: input.deliveryNotes?.trim() || null,
      })
      .select("id")
      .single();

    if (!error && data) {
      headerId = data.id;
      break;
    }
    // 23505 = choque con el consecutivo de otro usuario; se reintenta.
    if (error && error.code !== "23505") {
      throw new Error(`No fue posible crear el documento: ${error.message}`);
    }
  }

  if (!headerId) throw new Error("No fue posible generar un consecutivo único. Intenta de nuevo.");

  const { error: linesError } = await db.from("quick_rental_order_items").insert(
    input.lines.map((line) => ({
      order_id: headerId,
      inventory_item_id: line.inventoryItemId,
      equipment_name: line.equipmentName,
      quantity: line.quantity,
      daily_rate: line.dailyRate,
      deposit: line.deposit,
    })),
  );
  if (linesError) {
    throw new Error(
      `El documento ${code} quedó creado, pero las líneas no se guardaron: ${linesError.message}`,
    );
  }

  let signatureWarning: string | undefined;
  try {
    const path = `${headerId}/signature/${Date.now()}_firma-entrega.png`;
    const { error: uploadError } = await db.storage
      .from("rental-attachments")
      .upload(path, dataUrlToBlob(input.signatureDataUrl), { contentType: "image/png" });
    if (uploadError) throw uploadError;

    const { error: attachmentError } = await db
      .from("quick_rental_order_attachments")
      .insert({
        order_id: headerId,
        kind: "signature",
        storage_path: path,
        file_name: "firma-entrega.png",
        mime_type: "image/png",
      });
    if (attachmentError) throw attachmentError;
  } catch (error) {
    signatureWarning =
      error instanceof Error
        ? error.message
        : "la firma no pudo subirse al almacenamiento privado";
  }

  return { orderId: headerId, code, signatureWarning };
}

/**
 * Devuelve total o parcialmente una línea y recalcula el estado del documento.
 * No modifica inventario general: el alquiler es custodia, no una salida de
 * bodega.
 */
export async function returnQuickRentalLine(
  input: ReturnQuickRentalLineInput,
): Promise<{ status: QuickRentalOrderStatus }> {
  const db = client();
  if (!db) throw new Error("Supabase no está configurado: la devolución no se puede persistir.");
  const context = await resolveContext(db);
  if (!context) throw new Error("Inicia sesión para registrar la devolución.");

  const { data: order, error: orderError } = await db
    .from("quick_rental_orders")
    .select("company_id")
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order || order.company_id !== context.companyId) {
    throw new Error("El documento de alquiler no pertenece a tu empresa.");
  }

  const { data: line, error: lineError } = await db
    .from("quick_rental_order_items")
    .select("id,order_id,quantity,returned_quantity,extra_charge")
    .eq("id", input.lineId)
    .eq("order_id", input.orderId)
    .maybeSingle();
  if (lineError) throw lineError;
  if (!line) throw new Error("La línea del alquiler ya no existe.");

  const pending = Math.max(0, Number(line.quantity) - Number(line.returned_quantity));
  if (pending <= 0) throw new Error("Ese equipo ya fue devuelto por completo.");
  const requested = Number.isFinite(input.quantity) ? Math.floor(input.quantity) : 0;
  if (requested < 1) throw new Error("Indica cuántas unidades se reciben.");
  const quantity = Math.min(requested, pending);
  const notes = input.notes.trim();
  if (notes.length < 3) throw new Error("Describe el estado en que se recibe el equipo.");
  const extraCharge = Number.isFinite(input.extraCharge) ? Math.max(0, input.extraCharge) : 0;

  const { error: updateError } = await db
    .from("quick_rental_order_items")
    .update({
      returned_quantity: Number(line.returned_quantity) + quantity,
      returned_at: new Date().toISOString(),
      return_notes: notes,
      extra_charge: Number(line.extra_charge ?? 0) + extraCharge,
    })
    .eq("id", input.lineId)
    .eq("order_id", input.orderId);
  if (updateError) throw new Error(`No fue posible registrar la devolución: ${updateError.message}`);

  const { data: lines, error: linesError } = await db
    .from("quick_rental_order_items")
    .select("quantity,returned_quantity")
    .eq("order_id", input.orderId);
  if (linesError) throw linesError;

  const all = lines ?? [];
  const allReturned = all.length > 0 && all.every((item) => Number(item.returned_quantity) >= Number(item.quantity));
  const someReturned = all.some((item) => Number(item.returned_quantity) > 0);
  const status: QuickRentalOrderStatus = allReturned
    ? "returned"
    : someReturned
      ? "partially_returned"
      : "active";

  const { error: statusError } = await db
    .from("quick_rental_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", input.orderId)
    .eq("company_id", context.companyId);
  if (statusError) throw new Error(`La devolución se guardó, pero el estado no: ${statusError.message}`);

  return { status };
}

/** URL temporal para mostrar la firma guardada en el bucket privado. */
export async function getQuickRentalSignatureUrl(path: string): Promise<string | null> {
  const db = client();
  if (!db) return null;
  const { data, error } = await db.storage.from("rental-attachments").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
