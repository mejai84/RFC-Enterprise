/* ────────────────────────────────────────────────────────────
 * Mano de obra por obra
 * src/modules/quotes/domain/project-labor.ts
 * ─────────────────────────────────────────────────────────────
 *
 * Este módulo reproduce exactamente las fórmulas de la hoja de
 * cálculo de la tabla salarial de OCENSA, y encima agrega la capa
 * que hasta ahora no existía: los valores que el dueño estima
 * SOLO para una obra.
 *
 * Regla del negocio (acordada):
 * - La tabla salarial oficial nunca se modifica.
 * - Los conceptos por obra viven únicamente en la cotización.
 * - Al calcular, la cotización congela el resultado. Si después se
 *   actualiza la tabla, esa cotización no se mueve.
 * ───────────────────────────────────────────────────────────── */

/** Porcentajes de provisión. Salen de la hoja oficial de OCENSA. */
export const provisionRates = {
  /** Cesantías: 1 mes de salario al año. */
  cesantias: 0.0834,
  /** Prima de servicios: 1 mes al año. */
  prima: 0.0834,
  /** Vacaciones: 15 días hábiles al año. */
  vacaciones: 0.0417,
  /** Riesgo profesional (tarifa de la actividad). */
  riesgo: 0.0696,
  icbf: 0.03,
  sena: 0.02,
  caja: 0.04,
  eps: 0.125,
  pension: 0.16,
} as const;

/**
 * Interés sobre cesantías (Ley 52 de 1975): 12% anual sobre el saldo
 * acumulado, dividido entre 360 días. Equivale a 3,33% diario de la
 * cesantía. El rótulo "1%" que aparece en la hoja oficial es una
 * etiqueta equivocada; el cálculo correcto es este.
 */
export const interesCesantiasFactor = 12 / 360;

/** Recargo de la hora extra diurna (Art. 162 C.S.T.). */
export const recargoExtraDiurna = 0.25;
/** Recargo de la hora extra nocturna (Art. 163 C.S.T.). */
export const recargoExtraNocturna = 0.75;
/** Recargo dominical y festivo (Art. 165 C.S.T., ajustado en 2026). */
export const recargoDominical = 1.9;
/** La hoja oficial usa salario día entre 7 horas, no entre 8. */
export const horasPorDiaPago = 7;
/** Días de la tabla oficial. Cambia por proyecto. */
export const diasTablaOficial = 240;

/* ─────────────────────────────────────────────────────────────
 * BLOQUE 1 · Provisión sobre el salario
 * ───────────────────────────────────────────────────────────── */

export type ProvisionRow = {
  concept: string;
  base: number;
  rate: number;
  value: number;
};

export type ProvisionBreakdown = {
  salarioDia: number;
  transporteAuxilio: number;
  /** Subtotal base = salario + transporte. Toda la provisión se aplica sobre esto. */
  base: number;
  cesantias: number;
  interesCesantias: number;
  prima: number;
  vacaciones: number;
  riesgo: number;
  icbf: number;
  sena: number;
  caja: number;
  eps: number;
  pension: number;
  /** Subtotal diario provisionado. */
  totalProvisionadoDia: number;
  rows: ProvisionRow[];
};

/**
 * Bloque 1 de la hoja oficial. Solo se digitan dos números:
 * salario día y auxilio de transporte. Todo lo demás se calcula.
 */
export function computeProvision(
  salarioDia: number,
  transporteAuxilio: number,
): ProvisionBreakdown {
  const base = salarioDia + transporteAuxilio;
  const cesantias = base * provisionRates.cesantias;
  const interesCesantias = cesantias * interesCesantiasFactor;
  const prima = base * provisionRates.prima;
  const vacaciones = base * provisionRates.vacaciones;
  const riesgo = base * provisionRates.riesgo;
  const icbf = base * provisionRates.icbf;
  const sena = base * provisionRates.sena;
  const caja = base * provisionRates.caja;
  const eps = base * provisionRates.eps;
  const pension = base * provisionRates.pension;
  const totalProvisionadoDia =
    base +
    cesantias +
    interesCesantias +
    prima +
    vacaciones +
    riesgo +
    icbf +
    sena +
    caja +
    eps +
    pension;

  const rows: ProvisionRow[] = [
    { concept: "Salario día", base, rate: 0, value: salarioDia },
    { concept: "Auxilio de transporte", base, rate: 0, value: transporteAuxilio },
    { concept: "Subtotal base", base, rate: 0, value: base },
    { concept: "Cesantías", base, rate: provisionRates.cesantias, value: cesantias },
    {
      concept: "Interés de cesantías (12%/360)",
      base,
      rate: provisionRates.cesantias,
      value: interesCesantias,
    },
    { concept: "Prima de servicios", base, rate: provisionRates.prima, value: prima },
    { concept: "Vacaciones", base, rate: provisionRates.vacaciones, value: vacaciones },
    { concept: "Riesgo profesional", base, rate: provisionRates.riesgo, value: riesgo },
    { concept: "ICBF", base, rate: provisionRates.icbf, value: icbf },
    { concept: "SENA", base, rate: provisionRates.sena, value: sena },
    { concept: "Caja de compensación", base, rate: provisionRates.caja, value: caja },
    { concept: "EPS", base, rate: provisionRates.eps, value: eps },
    { concept: "Pensión", base, rate: provisionRates.pension, value: pension },
    { concept: "Subtotal diario provisionado", base, rate: 0, value: totalProvisionadoDia },
  ];

  return {
    salarioDia,
    transporteAuxilio,
    base,
    cesantias,
    interesCesantias,
    prima,
    vacaciones,
    riesgo,
    icbf,
    sena,
    caja,
    eps,
    pension,
    totalProvisionadoDia,
    rows,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Conceptos por obra
 * ───────────────────────────────────────────────────────────── */

/** Conceptos por obra, con su ayuda para el formulario. */
export type PerDiemKey =
  | "transporte"
  | "hidratacion"
  | "medico"
  | "trabajoEnAltura"
  | "espacioConfinado"
  | "hotel"
  | "alimentacion"
  | "otros";

export type PerDiemDefinition = {
  key: PerDiemKey;
  label: string;
  /** Si tiene regla, el valor se deriva de una tarifa por día. */
  rule?: "dias";
  /** Si es libre, el dueño escribe el total del periodo. */
  mode: "libre" | "regla";
  help: string;
};

export const perDiemConcepts: PerDiemDefinition[] = [
  {
    key: "transporte",
    label: "Transporte",
    mode: "libre",
    help: "Pasajes o interno de la obra para estos trabajadores.",
  },
  {
    key: "hidratacion",
    label: "Hidratación",
    mode: "libre",
    help: "Botella de agua o bebida por día de trabajo.",
  },
  {
    key: "medico",
    label: "Médico",
    mode: "libre",
    help: "Valor del médico o examen de la obra.",
  },
  {
    key: "trabajoEnAltura",
    label: "Trabajo en altura",
    mode: "libre",
    help: "Expediente y equipo para trabajo en alturas.",
  },
  {
    key: "espacioConfinado",
    label: "Espacio confinado",
    mode: "libre",
    help: "Certificado y equipo para espacios confinados.",
  },
  {
    key: "hotel",
    label: "Hotel",
    mode: "regla",
    rule: "dias",
    help: "Tarifa por día de alojamiento por el número de días. Aplica a capataz y conductor, y a las excepciones.",
  },
  {
    key: "alimentacion",
    label: "Alimentación",
    mode: "regla",
    rule: "dias",
    help: "Tarifa por día de alimentación por el número de días. Aplica a capataz y conductor, y a las excepciones.",
  },
  {
    key: "otros",
    label: "Otros",
    mode: "libre",
    help: "Cualquier otro concepto de la obra.",
  },
];

export function getPerDiemConcept(key: PerDiemKey): PerDiemDefinition {
  return perDiemConcepts.find((c) => c.key === key) ?? perDiemConcepts[perDiemConcepts.length - 1];
}

/**
 * Valores por obra. Los conceptos de tipo `libre` traen el total que
 * escribió el dueño. Los de tipo `regla` traen la tarifa por día,
 * porque el total se deriva de los días.
 */
export type ProjectPerDiemValues = {
  transporte: number;
  hidratacion: number;
  medico: number;
  trabajoEnAltura: number;
  espacioConfinado: number;
  hotel: number;
  alimentacion: number;
  otros: number;
};

/** Todos los conceptos en cero: punto de partida de una obra nueva. */
export function emptyPerDiem(): ProjectPerDiemValues {
  return {
    transporte: 0,
    hidratacion: 0,
    medico: 0,
    trabajoEnAltura: 0,
    espacioConfinado: 0,
    hotel: 0,
    alimentacion: 0,
    otros: 0,
  };
}

/* ─────────────────────────────────────────────────────────────
 * BLOQUE 2 · Horas y dominicales
 * ───────────────────────────────────────────────────────────── */

export type HoursInput = {
  /** Horas extra diurnas del mes. La hoja oficial usa 56. */
  horasExtraDiurnas: number;
  /** Horas extra nocturnas del mes. La hoja oficial deja 0. */
  horasExtraNocturnas: number;
  /** Horas dominicales del mes. La hoja oficial usa 14. */
  horasDominicales: number;
};

export const defaultHours: HoursInput = {
  horasExtraDiurnas: 56,
  horasExtraNocturnas: 0,
  horasDominicales: 14,
};

export type HoursBreakdown = {
  horaOrdinaria: number;
  valorHoraExtraDiurna: number;
  valorHoraExtraNocturna: number;
  valorHoraDominical: number;
  subtotalExtraDiurna: number;
  subtotalExtraNocturna: number;
  subtotalDominical: number;
  /** Suma de las tres, que es la que entra al total. */
  subtotalHoras: number;
};

/**
 * La hoja oficial calcula la hora ordinaria como salario día entre 7
 * (no entre 8), y aplica el recargo sobre esa hora.
 */
export function computeHours(salarioDia: number, hours: HoursInput): HoursBreakdown {
  const horaOrdinaria = salarioDia / horasPorDiaPago;
  const valorHoraExtraDiurna = horaOrdinaria * (1 + recargoExtraDiurna);
  const valorHoraExtraNocturna = horaOrdinaria * (1 + recargoExtraNocturna);
  const valorHoraDominical = horaOrdinaria * (1 + recargoDominical);
  const subtotalExtraDiurna = valorHoraExtraDiurna * hours.horasExtraDiurnas;
  const subtotalExtraNocturna = valorHoraExtraNocturna * hours.horasExtraNocturnas;
  const subtotalDominical = valorHoraDominical * hours.horasDominicales;
  return {
    horaOrdinaria,
    valorHoraExtraDiurna,
    valorHoraExtraNocturna,
    valorHoraDominical,
    subtotalExtraDiurna,
    subtotalExtraNocturna,
    subtotalDominical,
    subtotalHoras: subtotalExtraDiurna + subtotalDominical,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Cálculo completo de un puesto en una obra
 * ───────────────────────────────────────────────────────────── */

export type ProjectLaborInput = {
  /** Nombre del cargo o nivel, tal como aparece en la tabla. */
  nombre: string;
  codigo?: string;
  nivel?: number | null;
  salarioDia: number;
  /** Auxilio de transporte diario de la tabla oficial. */
  transporteAuxilio: number;
  /** Auxilio de alimentación diario (se cobra por días, no se provisiona). */
  alimentacionAuxilioDia: number;
  /** Auxilio sin incidencia salarial diario de la tabla oficial. */
  noSalarialDia: number;
  /** Número de personas de este puesto en la obra. */
  personal: number;
  /** Días de la obra. Se calculan del plazo y se pueden cambiar. */
  dias: number;
  /** Días de alojamiento. En la hoja oficial son 90, no los 240 de la tabla. */
  diasAlojamiento: number;
  /** Dotación total del puesto (uniforme, casco, botas). */
  dotacion: number;
  hours: HoursInput;
  perDiem: ProjectPerDiemValues;
};

export type PerDiemRow = {
  key: PerDiemKey;
  label: string;
  mode: "libre" | "regla";
  /** Valor digitado, o tarifa diaria si tiene regla. */
  input: number;
  /** Total del periodo después de aplicar la regla. */
  total: number;
  help: string;
};

export type ProjectLaborResult = {
  input: ProjectLaborInput;
  provision: ProvisionBreakdown;
  hours: HoursBreakdown;
  /** Provisionado diario de la tabla oficial por los días de la obra. */
  subTotalProvisionado: number;
  /** Auxilio de alimentación de la tabla, multiplicado por días. */
  alimentacionTabla: number;
  /** Auxilio sin incidencia salarial, multiplicado por días. */
  noSalarialPeriodo: number;
  /** Subtotal antes de salud y pensión. */
  subTotalAntesSalud: number;
  /** 8% de salud y pensión sobre la base imponible. */
  saludYPension: number;
  /** Subtotal de la hoja: base menos salud y pensión. */
  subTotalHoja: number;
  perDiemRows: PerDiemRow[];
  perDiemTotal: number;
  /** Suma final del periodo para toda la cuadrilla de este puesto. */
  totalPeriodo: number;
  /** Costo diario equivalente (total del periodo entre días). */
  valorDia: number;
};

/**
 * Reproduce el bloque completo de la hoja oficial, con la capa de
 * obra encima.
 *
 * Detalle importante: la hoja oficial resta el 8% de salud y pensión
 * en lugar de sumarlo (celda `AH = AF - AG`). Aquí se mantiene igual,
 * para que el número coincida con el Excel del cliente. Está marcado
 * como `verificarSaludYPension` para poder revisarlo sin romper la
 * equivalencia.
 */
export function computeProjectLabor(input: ProjectLaborInput): ProjectLaborResult {
  const provision = computeProvision(input.salarioDia, input.transporteAuxilio);
  const hours = computeHours(input.salarioDia, input.hours);
  const personal = Math.max(0, input.personal);
  const dias = Math.max(0, input.dias);
  const diasAlojamiento = Math.max(0, input.diasAlojamiento);

  const subTotalProvisionado = provision.totalProvisionadoDia * personal * dias;
  const alimentacionTabla = input.alimentacionAuxilioDia * personal * dias;
  const noSalarialPeriodo = input.noSalarialDia * personal * dias;

  const subTotalAntesSalud =
    subTotalProvisionado +
    hours.subtotalHoras +
    alimentacionTabla +
    noSalarialPeriodo;

  const baseSalud =
    provision.base * personal * dias + hours.subtotalHoras;
  const saludYPension = baseSalud * 0.08;
  const subTotalHoja = subTotalAntesSalud - saludYPension;

  const perDiemRows: PerDiemRow[] = perDiemConcepts.map((concept) => {
    const raw = input.perDiem[concept.key] ?? 0;
    const total =
      concept.mode === "regla" ? raw * diasAlojamiento * personal : raw * personal;
    return {
      key: concept.key,
      label: concept.label,
      mode: concept.mode,
      input: raw,
      total,
      help: concept.help,
    };
  });
  const perDiemTotal = perDiemRows.reduce((sum, row) => sum + row.total, 0);

  const totalPeriodo = subTotalHoja + perDiemTotal + input.dotacion * personal;
  const valorDia = dias > 0 ? totalPeriodo / dias : 0;

  return {
    input,
    provision,
    hours,
    subTotalProvisionado,
    alimentacionTabla,
    noSalarialPeriodo,
    subTotalAntesSalud,
    saludYPension,
    subTotalHoja,
    perDiemRows,
    perDiemTotal,
    totalPeriodo,
    valorDia,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Días de la obra
 * ───────────────────────────────────────────────────────────── */

/**
 * Días entre dos fechas, inclusive. Los días se calculan del plazo
 * de la obra, pero el dueño puede cambiarlos a mano.
 */
export function daysBetween(start: string, end: string): number | null {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (diff < 0) return null;
  return diff + 1;
}

/**
 * Días de alojamiento: la hoja oficial usa 90 días (tres meses),
 * aunque la tabla sea de 240. Si el plazo de la obra es menor, se
 * toma el plazo completo.
 */
export function defaultLodgingDays(diasObra: number): number {
  return Math.min(diasObra, 90);
}

/* ─────────────────────────────────────────────────────────────
 * Instantánea congelada
 * ───────────────────────────────────────────────────────────── */

export type QuoteLaborSnapshot = {
  /** Días que se usaron en el cálculo. */
  dias: number;
  diasAlojamiento: number;
  /** Fecha en que se calculó. */
  calculadoEn: string;
  /** Identificador de la tabla oficial usada. */
  tablaId?: string;
  tablaNombre?: string;
  /** Valores de la tabla en el momento del cálculo. */
  tabla: {
    id?: string;
    code: string;
    name: string;
    level: number | null;
    dailyBasicSalary: number;
    transportAllowance: number;
    foodAllowance: number;
    nonSalaryAllowance: number;
  }[];
  /** Conceptos por obra, tal como los escribió el dueño. */
  perDiem: ProjectPerDiemValues;
  hours: HoursInput;
  /** Resultado por cargo, ya congelado. */
  resultados: {
    codigo: string;
    nombre: string;
    personal: number;
    valorDia: number;
    totalPeriodo: number;
  }[];
  totalObra: number;
};