/* ─────────────────────────────────────────────────────────────
 * Módulo de Cotizaciones – Dominio
 * src/modules/quotes/domain/quote.ts
 * ───────────────────────────────────────────────────────────── */

/** Estados del pipeline comercial en orden de flujo */
export const quoteStatuses = [
  { value: "received",          label: "Recibido",              icon: "📥", color: "#6366f1" },
  { value: "in_review",         label: "En revisión",           icon: "🔎", color: "#8b5cf6" },
  { value: "estimating",        label: "Cotización en proceso", icon: "📝", color: "#f59e0b" },
  { value: "sent",              label: "Cotización enviada",    icon: "📤", color: "#3b82f6" },
  { value: "awaiting_response", label: "Esperando respuesta",   icon: "⏳", color: "#64748b" },
  { value: "revision_requested",label: "Por modificar",         icon: "🔄", color: "#e879f9" },
  { value: "confirmed",         label: "Trabajo confirmado",    icon: "✅", color: "#10b981" },
  { value: "in_execution",      label: "En ejecución",          icon: "🚧", color: "#0ea5e9" },
  { value: "work_completed",    label: "Trabajo terminado",     icon: "📋", color: "#059669" },
  { value: "billing_pending",   label: "Pendiente pago",        icon: "💰", color: "#eab308" },
  { value: "closed",            label: "Cerrado",               icon: "🟢", color: "#22c55e" },
  { value: "lost",              label: "No adjudicado",         icon: "❌", color: "#ef4444" },
] as const;

export type QuoteStatus = (typeof quoteStatuses)[number]["value"];

/** Columnas visibles en el Kanban operativo (las más usadas día a día) */
export const kanbanColumns: QuoteStatus[] = quoteStatuses.map((status) => status.value);

export type QuoteHistoryEntry = {
  id: string;
  fromStatus: QuoteStatus | null;
  toStatus: QuoteStatus;
  changedBy: string;
  changedAt: string; // ISO date-time
  note?: string;
};

/** Desglose de pre-costeo por 3 rubros principales + imprevistos/transporte */
export type QuoteCostBreakdown = {
  materials: number;   // Insumos y materiales COP
  labor: number;       // Mano de obra y cuadrilla COP
  equipment: number;   // Maquinaria, herramientas y equipos COP
  transport?: number;  // Fletes y logística COP
  indirects?: number;  // Imprevistos, administración o AIU COP
};

/** Medición u ítem verificado durante la visita técnica de campo */
export type TechnicalVisitMeasurement = {
  concept: string;
  quantity?: number;
  unit?: string;
  notes?: string;
};

/** Evidencia fotográfica de la visita técnica */
export type TechnicalVisitPhoto = {
  storagePath: string;
  fileName: string;
  uploadedAt: string;
};

/** Punto de control de la lista de chequeo técnica */
export type TechnicalVisitChecklistItem = {
  label: string;
  done: boolean;
};

/** Registro de visita técnica de inspección en campo previa a cotizar */
export type TechnicalVisit = {
  required: boolean;
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:MM
  responsible?: string;
  status: "pending" | "completed" | "not_required";
  findings?: string;     // Observaciones o alcance en campo
  measurements?: TechnicalVisitMeasurement[];
  photos?: TechnicalVisitPhoto[];
  checklist?: TechnicalVisitChecklistItem[];
  checklistTemplate?: string;
  signaturePath?: string;
  signedByName?: string;
  signedByRole?: string;
  signedAt?: string;
  geo?: { latitude: number; longitude: number; accuracy?: number };
  executedAt?: string;
  closedBy?: string;
  materialsMissing?: string;
  linkedRequisitionId?: string;
  linkedRequisitionCode?: string;
};

/** Una visita técnica identificada dentro de una lista de visitas */
export type TechnicalVisitEntry = TechnicalVisit & {
  /** Identificador estable de la visita dentro de la lista */
  id: string;
  /** Consecutivo legible dentro de la cotización u obra: VISITA-01, VISITA-02… */
  sequence?: string;
};

/** Plantillas de lista de chequeo por tipo de servicio */
export const technicalVisitChecklistTemplates: Record<string, { label: string; items: string[] }> = {
  construccion: {
    label: "Construcción / montaje",
    items: [
      "Accesos y rutas de ingreso verificados",
      "Nivelación y replanteo comprobado",
      "Estado del terreno y taludes revisado",
      "Disponibilidad de agua y energía en sitio",
      "Áreas de trabajo delimitadas y señalizadas",
      "Seguridad, señalización y EPP disponibles",
    ],
  },
  mantenimiento: {
    label: "Mantenimiento correctivo",
    items: [
      "Equipo detenido y bloqueado (LOTO)",
      "Alcance del daño identificado y documentado",
      "Herramientas y repuestos necesarios verificados",
      "Reparación tentativa y tiempo estimado",
      "Riesgos de reignición o arranque accidental",
    ],
  },
  instalacion: {
    label: "Instalación / interconexión",
    items: [
      "Punto de instalación verificado en sitio",
      "Mediciones de campo tomadas y registradas",
      "Accesibilidad para maniobra y mantenimiento",
      "Aislamiento, tierra y pruebas previas",
      "Interferencias con redes existentes revisadas",
    ],
  },
};

/**
 * Lista de visitas de una cotización u obra. Se mantiene `technicalVisit`
 * como la última visita para no romper lecturas existentes.
 */
export type QuoteVisits = TechnicalVisitEntry[];

export type Quote = {
  id: string;
  code: string;            // COT-{seq}-{año}-{cliente}-{obra}
  revision: number;        // 0 = R0 (original), 1 = R1, 2 = R2...
  title: string;           // Resumen o nombre de la obra / solicitud
  client: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  emailOrigin?: string;     // Correo/asunto de donde llegó la solicitud
  status: QuoteStatus;
  responsible: string;      // Nombre del responsable interno (ej. Jorge Figueroa)
  estimatedValue?: number;  // Valor total estimado en COP
  costBreakdown?: QuoteCostBreakdown; // Desglose de costeo
  validityDays?: number;    // Días de validez comercial (por defecto 30 días)
  sentAt?: string;          // Fecha en que se envió al cliente ISO (YYYY-MM-DD)
  deliveryTimeWeeks?: number; // Tiempo de ejecución o entrega en semanas
  paymentTerms?: string;    // Condiciones de pago (ej. "50% anticipo, 50% contra entrega")
  technicalVisit?: TechnicalVisit; // Última visita técnica registrada (compatibilidad)
  technicalVisits?: QuoteVisits;   // Todas las visitas técnicas de la cotización/obra
  folderUrl?: string;       // Enlace a expediente en la nube (Drive, OneDrive, SharePoint)
  requestBody?: string;     // Cuerpo del correo o mensaje original de la solicitud
  receivedAt: string;       // Fecha de recepción ISO
  deadline?: string;        // Fecha límite de entrega de cotización ISO
  nextAction?: string;      // Próxima acción pendiente
  projectId?: string;       // ID del proyecto vinculado (cuando se convierte a obra)
  projectCode?: string;     // Código del proyecto vinculado
  notes?: string;           // Observaciones generales
  laborScale?: "rfc_standard" | "ocensa"; // Escala salarial aplicada a los APUs de esta cotización
  laborRateTableId?: string; // Tabla salarial persistida para esta cotización.
  laborRateSnapshot?: Record<string, unknown>; // Copia inmutable de los valores aplicados.
  history: QuoteHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

/* ── Gestión de visitas técnicas ──────────────────────────── */

/** Devuelve la lista de visitas, migrando la visita única legacy si hace falta. */
export function getQuoteVisits(quote: {
  technicalVisit?: TechnicalVisit;
  technicalVisits?: QuoteVisits;
}): QuoteVisits {
  if (Array.isArray(quote.technicalVisits) && quote.technicalVisits.length) {
    return quote.technicalVisits.map((visit, index) => ({
      ...visit,
      id: visit.id ?? `legacy-${index}`,
      sequence: visit.sequence ?? `VISITA-${String(index + 1).padStart(2, "0")}`,
    }));
  }
  if (quote.technicalVisit) {
    return [
      {
        ...quote.technicalVisit,
        id: "legacy-0",
        sequence: "VISITA-01",
      },
    ];
  }
  return [];
}

/** Consecutivo de visita: VISITA-01, VISITA-02… */
export function nextVisitSequence(visits: QuoteVisits): string {
  return `VISITA-${String(visits.length + 1).padStart(2, "0")}`;
}

/** Crea una visita nueva al final de la lista, conservando la anterior. */
export function appendVisit(
  visits: QuoteVisits,
  visit: TechnicalVisit,
): QuoteVisits {
  return [
    ...visits,
    {
      ...visit,
      id: crypto.randomUUID(),
      sequence: nextVisitSequence(visits),
    },
  ];
}

/* ── Generador de código consecutivo ──────────────────────── */

/** Limpia texto para usar en códigos sin espacios ni caracteres especiales */
export function slugifyCodePart(text: string, maxLen = 16): string {
  if (!text) return "GENERAL";
  const clean = text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // elimina tildes
    .replace(/[^A-Z0-9]+/g, "_")     // reemplaza espacios y símbolos con _
    .replace(/^_+|_+$/g, "");        // recorta guiones bajos al inicio/final
  return clean.slice(0, maxLen) || "GENERAL";
}

/**
 * Consecutivo estándar RFC:
 * COT-{numero_consecutivo_automatico}-{año_actual}-{nombre_empresa}-{obra}
 * Ejemplo: COT-001-2026-OCENSA-CHIMENEA_CCM
 */
export function getNextQuoteCode(
  quotes: ReadonlyArray<Pick<Quote, "code">>,
  client = "CLIENTE",
  workName = "OBRA",
  year?: number,
): string {
  const y = year ?? new Date().getFullYear();

  // Buscar el número consecutivo más alto del año en cualquier formato existente
  const maxSeq = quotes.reduce((highest, q) => {
    // Coincidir COT-###-AAAA...
    const matchNew = q.code.match(/^COT-(\d+)-(\d{4})/i);
    if (matchNew && parseInt(matchNew[2], 10) === y) {
      const seq = parseInt(matchNew[1], 10);
      return Number.isNaN(seq) ? highest : Math.max(highest, seq);
    }
    // Coincidir formato anterior COT-AAAA-###
    const matchOld = q.code.match(/^COT-(\d{4})-(\d+)/i);
    if (matchOld && parseInt(matchOld[1], 10) === y) {
      const seq = parseInt(matchOld[2], 10);
      return Number.isNaN(seq) ? highest : Math.max(highest, seq);
    }
    return highest;
  }, 0);

  const seqStr = String(maxSeq + 1).padStart(3, "0");
  const clientSlug = slugifyCodePart(client, 14);
  const workSlug = slugifyCodePart(workName, 22);

  return `COT-${seqStr}-${y}-${clientSlug}-${workSlug}`;
}

/* ── Helpers ──────────────────────────────────────────────── */

export function getStatusMeta(status: QuoteStatus) {
  return quoteStatuses.find((s) => s.value === status)!;
}

/** Días transcurridos desde una fecha ISO hasta hoy */
export function daysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** ¿La cotización lleva más de N días en "esperando respuesta"? */
export function isStale(quote: Quote, thresholdDays = 3): boolean {
  return quoteStaleness(quote).days >= thresholdDays;
}

export type QuoteStalenessLevel = "ok" | "warning" | "critical";

export type QuoteStaleness = {
  level: QuoteStalenessLevel;
  /** Días que lleva la cotización esperando una acción. */
  days: number;
  /** Texto corto para mostrar en la tarjeta. */
  label: string;
};

/**
 * Semáforo de antigüedad de una cotización.
 *
 * Antes solo existía un borde de color que se encendía cuando la quotation llevaba
 * más de tres días en «esperando respuesta». Eso dejaba fuera dos casos reales: una
 * cotización enviada al cliente que nadie responde, y una que lleva semanas en
 * «borrador» sin llegar a enviarse. Y el color solo no dice nada por sí solo, así que
 * cada nivel lleva su texto.
 *
 * Los días se cuentan desde el último movimiento que dejó la cotización en un
 * estado de espera, y no desde que se creó.
 */
export function quoteStaleness(
  quote: Quote,
  options: { warningDays?: number; criticalDays?: number } = {},
): QuoteStaleness {
  const warningDays = options.warningDays ?? 3;
  const criticalDays = options.criticalDays ?? 7;

  const waitingStatuses: Quote["status"][] = ["awaiting_response", "sent"];
  if (!waitingStatuses.includes(quote.status)) {
    return { level: "ok", days: 0, label: "" };
  }

  const lastChange = quote.history
    .filter((h) => waitingStatuses.includes(h.toStatus))
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))[0];
  const days = daysSince(lastChange?.changedAt ?? quote.updatedAt);

  if (days >= criticalDays) return { level: "critical", days, label: `${days} días esperando` };
  if (days >= warningDays) return { level: "warning", days, label: `${days} días esperando` };
  return { level: "ok", days, label: days > 0 ? `${days} día${days === 1 ? "" : "s"} esperando` : "" };
}

/** Devuelve el código con sufijo de revisión si aplica (ej. COT-001-2026-OCENSA-CHIMENEA-R1) */
export function getEffectiveQuoteCode(quote: Quote): string {
  if (quote.revision && quote.revision > 0) {
    return `${quote.code}-R${quote.revision}`;
  }
  return quote.code;
}

/** Calcula la suma total de los 3 rubros + adicionales del pre-costeo */
export function calculateTotalCost(breakdown?: Partial<QuoteCostBreakdown>): number {
  if (!breakdown) return 0;
  return (
    (breakdown.materials ?? 0) +
    (breakdown.labor ?? 0) +
    (breakdown.equipment ?? 0) +
    (breakdown.transport ?? 0) +
    (breakdown.indirects ?? 0)
  );
}

/** Semáforo de vigencia comercial de la cotización enviada */
export function getOfferExpiry(quote: Quote): {
  daysLeft: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiryDateStr?: string;
} {
  const validityDays = quote.validityDays ?? 30;
  const baseDateStr = quote.sentAt ?? quote.updatedAt.slice(0, 10);
  const baseTime = new Date(baseDateStr).getTime();
  const expiryTime = baseTime + validityDays * 24 * 60 * 60 * 1000;
  const diffMs = expiryTime - Date.now();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const expiryDate = new Date(expiryTime).toISOString().slice(0, 10);

  return {
    daysLeft,
    isExpired: daysLeft <= 0,
    isExpiringSoon: daysLeft > 0 && daysLeft <= 5,
    expiryDateStr: expiryDate,
  };
}
