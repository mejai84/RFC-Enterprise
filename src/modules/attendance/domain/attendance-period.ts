import type { AttendanceEmployee, AttendancePeriodSummary, WorkCheckIn } from "./work-check-in";

export type AttendancePeriodKind = "day" | "week" | "month";

export const attendancePeriodOptions: Array<{ value: AttendancePeriodKind; label: string }> = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

/**
 * Rango de fechas locales (America/Bogota) del período elegido.
 *
 * Las fechas llegan al servidor como `date` y allí se comparan contra el día local
 * del registro; el navegador nunca decide a qué día pertenece una declaración.
 */
export type AttendancePeriodRange = {
  from: string;
  to: string;
  label: string;
};

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Día local de Bogotá en formato YYYY-MM-DD, independiente del huso del equipo. */
export function bogotaToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function resolveAttendancePeriod(kind: AttendancePeriodKind, anchor: string): AttendancePeriodRange {
  const base = parseLocalDate(anchor);

  if (kind === "day") {
    const day = toIsoDate(base);
    return { from: day, to: day, label: formatLongDate(day) };
  }

  if (kind === "week") {
    // getUTCDay: 0 = domingo. La semana operativa va de lunes a domingo.
    const weekday = base.getUTCDay();
    const offsetToMonday = (weekday + 6) % 7;
    const monday = new Date(base.getTime());
    monday.setUTCDate(base.getUTCDate() - offsetToMonday);
    const sunday = new Date(monday.getTime());
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      from: toIsoDate(monday),
      to: toIsoDate(sunday),
      label: `Semana del ${formatShortDate(toIsoDate(monday))} al ${formatShortDate(toIsoDate(sunday))}`,
    };
  }

  const monthStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
  const monthName = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "UTC" }).format(monthStart);
  return {
    from: toIsoDate(monthStart),
    to: toIsoDate(monthEnd),
    label: `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} de ${monthStart.getUTCFullYear()}`,
  };
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "full", timeZone: "UTC" }).format(parseLocalDate(value));
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", timeZone: "UTC" }).format(parseLocalDate(value));
}

/** Siguiente o anterior período, para moverse sin escribir fechas a mano. */
export function shiftAttendancePeriod(kind: AttendancePeriodKind, anchor: string, direction: 1 | -1): string {
  const base = parseLocalDate(anchor);
  if (kind === "day") {
    base.setUTCDate(base.getUTCDate() + direction);
    return toIsoDate(base);
  }
  if (kind === "week") {
    base.setUTCDate(base.getUTCDate() + 7 * direction);
    return toIsoDate(base);
  }
  base.setUTCMonth(base.getUTCMonth() + direction);
  return toIsoDate(base);
}

export function countPeriodDays(range: AttendancePeriodRange): number {
  const from = parseLocalDate(range.from).getTime();
  const to = parseLocalDate(range.to).getTime();
  return Math.round((to - from) / 86_400_000) + 1;
}

export type AttendanceRollupRow = {
  employeeId: string;
  employeeName: string;
  jobTitle?: string;
  daysWithRecord: number;
  totalRecords: number;
  fronts: number;
  lastSite?: string;
  lastActivity?: string;
};

/**
 * Resumen por empleado del período. El día y la hora llegan del servidor, así que
 * "días con registro" cuenta fechas locales reales y no días desplazados por el huso
 * del navegador.
 */
export function buildAttendanceRollups(
  records: WorkCheckIn[],
  employees: AttendanceEmployee[],
  range: AttendancePeriodRange,
): AttendanceRollupRow[] {
  const inRange = records.filter((record) => record.localDate >= range.from && record.localDate <= range.to);
  const rows = new Map<string, AttendanceRollupRow>();

  const ensure = (employeeId: string, employeeName: string, jobTitle?: string) => {
    const existing = rows.get(employeeId);
    if (existing) return existing;
    const created: AttendanceRollupRow = {
      employeeId,
      employeeName,
      jobTitle,
      daysWithRecord: 0,
      totalRecords: 0,
      fronts: 0,
    };
    rows.set(employeeId, created);
    return created;
  };

  for (const record of inRange) {
    const row = ensure(record.employeeId, record.employeeName);
    row.totalRecords += 1;
  }

  const daySets = new Map<string, Set<string>>();
  const frontSets = new Map<string, Set<string>>();
  for (const record of inRange) {
    if (!daySets.has(record.employeeId)) daySets.set(record.employeeId, new Set());
    daySets.get(record.employeeId)!.add(record.localDate);
    const front = record.projectLabel ?? record.siteName;
    if (!frontSets.has(record.employeeId)) frontSets.set(record.employeeId, new Set());
    frontSets.get(record.employeeId)!.add(front);
  }

  for (const [employeeId, row] of rows) {
    row.daysWithRecord = daySets.get(employeeId)?.size ?? 0;
    row.fronts = frontSets.get(employeeId)?.size ?? 0;
  }

  // Los empleados activos sin una sola declaración también se listan: la ausencia
  // de registro es información de la jornada, no un vacío de la base.
  for (const employee of employees) {
    const row = rows.get(employee.id);
    if (row) {
      row.jobTitle = employee.jobTitle ?? row.jobTitle;
      continue;
    }
    rows.set(employee.id, {
      employeeId: employee.id,
      employeeName: employee.fullName,
      jobTitle: employee.jobTitle,
      daysWithRecord: 0,
      totalRecords: 0,
      fronts: 0,
    });
  }

  const ordered = [...rows.values()];
  // Primero quien tiene registros, ordenados por días declarados; después los que no declararon.
  return ordered.sort((a, b) => {
    if (b.daysWithRecord !== a.daysWithRecord) return b.daysWithRecord - a.daysWithRecord;
    if (b.totalRecords !== a.totalRecords) return b.totalRecords - a.totalRecords;
    return a.employeeName.localeCompare(b.employeeName, "es-CO");
  });
}

export function summarizeAttendance(
  rollups: AttendanceRollupRow[],
  records: WorkCheckIn[],
): AttendancePeriodSummary {
  const fronts = new Set<string>();
  for (const record of records) fronts.add(record.projectLabel ?? record.siteName);
  return {
    employeesWithRecord: rollups.filter((row) => row.daysWithRecord > 0).length,
    employeesWithoutRecord: rollups.filter((row) => row.daysWithRecord === 0).length,
    totalRecords: records.length,
    frontsWithActivity: fronts.size,
  };
}

/** Registros de un empleado, agrupados por día local para el detalle expandible. */
export function groupRecordsByDay(records: WorkCheckIn[]): Array<{ date: string; records: WorkCheckIn[] }> {
  const grouped = new Map<string, WorkCheckIn[]>();
  for (const record of records) {
    const bucket = grouped.get(record.localDate);
    if (bucket) bucket.push(record);
    else grouped.set(record.localDate, [record]);
  }
  return [...grouped.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({ date, records: items }));
}