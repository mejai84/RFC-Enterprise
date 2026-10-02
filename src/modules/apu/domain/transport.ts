/* ─────────────────────────────────────────────────────────────
 * Módulo APU – Catálogo y Dominio de Transporte y Logística
 * Modelado según estándares de gestión de flotas y costos de fletes
 * (Odoo Fleet / Construction Freight / PMI Construction Extension)
 * ───────────────────────────────────────────────────────────── */

export type TransportCategory =
  | "carga_pesada"
  | "volquetas"
  | "transporte_personal"
  | "vehiculos_livianos"
  | "fluvial_especial";

export const transportCategoryLabels: Record<TransportCategory, string> = {
  carga_pesada: "Carga pesada y maquinaria (Lowboy / Cama alta)",
  volquetas: "Volquetas y acarreo de materiales",
  transporte_personal: "Transporte de personal y cuadrillas",
  vehiculos_livianos: "Vehículos livianos y utilitarios 4x4",
  fluvial_especial: "Transporte fluvial y logística especial",
};

export type TransportUnit = "viaje" | "día" | "mes" | "hora" | "km" | "gl";

export type TransportItem = {
  id: string;
  code: string;
  name: string;
  category: TransportCategory;
  categoryLabel: string;
  unit: TransportUnit;
  defaultRate: number; // Tarifa diaria/unitaria de referencia COP
  capacity?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TransportCatalog = {
  items: TransportItem[];
  source: "database" | "fallback";
  warning?: string;
};

/* ── Catálogo Semilla de Transporte según Estándares de Obra e Industria ── */
export const defaultTransportCatalog: TransportItem[] = [
  /* ── 1. Carga pesada y maquinaria ── */
  {
    id: "trans-camabaja-30t",
    code: "TR-CB-30T",
    name: "Cama Baja (Lowboy) 30 Toneladas",
    category: "carga_pesada",
    categoryLabel: "Carga pesada y maquinaria (Lowboy / Cama alta)",
    unit: "viaje",
    defaultRate: 2400000,
    capacity: "Hasta 30 Toneladas",
    description: "Movilización de retroexcavadoras de oruga, vibrocompactadores y motoniveladoras hacia el frente de obra.",
    isActive: true,
  },
  {
    id: "trans-camabaja-50t",
    code: "TR-CB-50T",
    name: "Cama Baja (Lowboy) 50 Toneladas / Cuello Desmontable",
    category: "carga_pesada",
    categoryLabel: "Carga pesada y maquinaria (Lowboy / Cama alta)",
    unit: "viaje",
    defaultRate: 3600000,
    capacity: "Hasta 50 Toneladas",
    description: "Transporte de grúas de alto tonelaje, tractores tiendetubos (Sideboom) y módulos pesados.",
    isActive: true,
  },
  {
    id: "trans-camaalta-planchon",
    code: "TR-CA-PLANCHON",
    name: "Cama Alta / Planchón 3 Ejes (40 pies)",
    category: "carga_pesada",
    categoryLabel: "Carga pesada y maquinaria (Lowboy / Cama alta)",
    unit: "viaje",
    defaultRate: 1850000,
    capacity: "Hasta 32 Ton / 12 metros",
    description: "Transporte de tubería de línea de 40 pies, perfiles estructurales, casetas y contenedores de campamento.",
    isActive: true,
  },
  {
    id: "trans-camion-grua",
    code: "TR-CG-5T",
    name: "Camión Grúa con Brazo Hidráulico Articulado 5 Ton",
    category: "carga_pesada",
    categoryLabel: "Carga pesada y maquinaria (Lowboy / Cama alta)",
    unit: "día",
    defaultRate: 1450000,
    capacity: "Brazo 5 Ton / Capacidad carga 10 Ton",
    description: "Autocargue, transporte en plataforma y descargue preciso de tubos, bombas y accesorios en frentes de línea.",
    isActive: true,
  },

  /* ── 2. Volquetas y acarreo de materiales ── */
  {
    id: "trans-volqueta-sencilla",
    code: "TR-VOLQ-SENC",
    name: "Volqueta Sencilla 7 m³",
    category: "volquetas",
    categoryLabel: "Volquetas y acarreo de materiales",
    unit: "día",
    defaultRate: 580000,
    capacity: "7 Metros Cúbicos",
    description: "Transporte local y distribución de arena, triturado, escombros y afirmado en zonas de acceso restringido.",
    isActive: true,
  },
  {
    id: "trans-volqueta-dobletroque",
    code: "TR-VOLQ-DOBLE",
    name: "Volqueta Dobletroque 15 m³",
    category: "volquetas",
    categoryLabel: "Volquetas y acarreo de materiales",
    unit: "día",
    defaultRate: 980000,
    capacity: "15 Metros Cúbicos",
    description: "Acarreo masivo de material de subbase, suelo de excavación y agregados para obras civiles de línea.",
    isActive: true,
  },

  /* ── 3. Transporte de personal y cuadrillas ── */
  {
    id: "trans-buseta-personal",
    code: "TR-BUS-28P",
    name: "Buseta de Transporte de Personal (24-30 Pasajeros)",
    category: "transporte_personal",
    categoryLabel: "Transporte de personal y cuadrillas",
    unit: "día",
    defaultRate: 850000,
    capacity: "28 Pasajeros sentados con A/C",
    description: "Ruta diaria de cuadrillas técnicas y operativas entre campamento/Caucasia y los frentes de obra.",
    isActive: true,
  },
  {
    id: "trans-van-personal",
    code: "TR-VAN-15P",
    name: "Van / Microbús de Personal (12-16 Pasajeros)",
    category: "transporte_personal",
    categoryLabel: "Transporte de personal y cuadrillas",
    unit: "día",
    defaultRate: 650000,
    capacity: "15 Pasajeros con A/C",
    description: "Movilización ágil de cuadrillas especializadas (soldadura, pintura industrial, instrumentación y topografía).",
    isActive: true,
  },

  /* ── 4. Vehículos livianos y utilitarios 4x4 ── */
  {
    id: "trans-camioneta-4x4",
    code: "TR-CAM-4X4",
    name: "Camioneta 4x4 Doble Cabina Platón Diésel",
    category: "vehiculos_livianos",
    categoryLabel: "Vehículos livianos y utilitarios 4x4",
    unit: "día",
    defaultRate: 520000,
    capacity: "5 Pasajeros + Platón 1 Ton",
    description: "Transporte de ingenieros residentes, supervisores HSE, equipos de calibración y traslados de emergencia.",
    isActive: true,
  },
  {
    id: "trans-camion-doblecabina",
    code: "TR-CAM-DC-3T",
    name: "Camión Doble Cabina 3.5 Ton con Carrocería de Estacas",
    category: "vehiculos_livianos",
    categoryLabel: "Vehículos livianos y utilitarios 4x4",
    unit: "día",
    defaultRate: 720000,
    capacity: "5 Operarios + 3.5 Toneladas de carga",
    description: "Transporte conjunto de cuadrilla con compresor, equipos de oxicorte, motobombas y consumibles.",
    isActive: true,
  },

  /* ── 5. Transporte fluvial y logística especial ── */
  {
    id: "trans-bote-fluvial",
    code: "TR-BOTE-FLUVIAL",
    name: "Bote a Motor Fuera de Borda / Transporte Fluvial",
    category: "fluvial_especial",
    categoryLabel: "Transporte fluvial y logística especial",
    unit: "día",
    defaultRate: 480000,
    capacity: "12 Pasajeros con chalecos reglamentarios",
    description: "Cruce de personal, herramientas e insumos por el río Cauca o ciénagas hacia derechos de vía inaccesibles por tierra.",
    isActive: true,
  },
  {
    id: "trans-carrotanque-agua-diesel",
    code: "TR-CARR-AGUA",
    name: "Camión Carrotanque de Agua / Combustible 2.500 Galones",
    category: "fluvial_especial",
    categoryLabel: "Transporte fluvial y logística especial",
    unit: "día",
    defaultRate: 1100000,
    capacity: "2.500 Galones con motobomba de trasiego",
    description: "Suministro de agua para pruebas hidrostáticas, mitigación de polvo y abastecimiento de diésel para maquinaria.",
    isActive: true,
  },
  {
    id: "trans-flete-expreso",
    code: "TR-FLETE-EXPR",
    name: "Flete Expreso Logística Caucasia - Frente de Obra",
    category: "carga_pesada",
    categoryLabel: "Carga pesada y maquinaria (Lowboy / Cama alta)",
    unit: "viaje",
    defaultRate: 450000,
    capacity: "Hasta 5 Toneladas",
    description: "Envío urgente y puntual de repuestos, pernos, electrodos o equipos desde base operativa hacia el frente de trabajo.",
    isActive: true,
  },
];
