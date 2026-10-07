export type WorkCheckIn = {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId?: string;
  projectLabel?: string;
  siteName: string;
  activityDescription: string;
  checkedInAt: string;
  /** Fecha local (America/Bogota) calculada por el servidor. */
  localDate: string;
  /** Hora local (HH24:MI) calculada por el servidor. */
  localTime: string;
  /** Punto declarado voluntariamente, si el empleado pulsó el botón de ubicación. */
  location?: DeclaredLocationRecord;
};

export type DeclaredLocationRecord = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  label?: string;
};

export type AttendanceProject = {
  id: string;
  label: string;
  location: string;
};

export type AttendanceEmployee = {
  id: string;
  fullName: string;
  jobTitle?: string;
};

export type WorkCheckInWorkspaceData = {
  employeeName?: string;
  canReview: boolean;
  projects: AttendanceProject[];
  employees: AttendanceEmployee[];
  checkIns: WorkCheckIn[];
};

/** Registros que devuelve la consulta gerencial dentro del período activo. */
export type AttendancePeriodSummary = {
  employeesWithRecord: number;
  employeesWithoutRecord: number;
  totalRecords: number;
  frontsWithActivity: number;
};

/**
 * Política del botón de mapa.
 *
 * `optional`: el empleado puede abrir el mapa para ubicarse mejor, pero registrar
 * su jornada no depende de ello. Es el valor vigente y el que protege la relación
 * laboral: la ayuda no puede convertirse en una condición para trabajar.
 *
 * `required`: la empresa decide que la declaración debe apoyarse en la apertura del
 * mapa. La rama ya está implementada y probada, de modo que activarla es cambiar
 * esta constante, sin rehacer la pantalla ni el modelo de datos. Activarla exige un
 * acuerdo escrito previo (riesgo LAB-001).
 */
export const ATTENDANCE_MAP_REQUIREMENT = "optional" as "optional" | "required";

export type WorkCheckInFormValues = {
  projectId: string;
  siteName: string;
  activityDescription: string;
  location?: DeclaredLocationRecord;
};

export const SITE_MIN = 3;
export const SITE_MAX = 160;
export const ACTIVITY_MIN = 3;
export const ACTIVITY_MAX = 500;

export type WorkCheckInFormErrors = Partial<Record<keyof WorkCheckInFormValues | "maps", string>>;

/**
 * Texto que se le presenta a la persona antes de compartir su ubicación.
 * Se muestra siempre, tanto si la ubicación es obligatoria como si no, porque
 * el consentimiento tiene que ser explícito en los dos casos.
 */
export const LOCATION_CONSENT_TEXT =
  "Si activas el botón de ubicación, guardamos el punto donde estás en ese momento con la hora del servidor. Es opcional: puedes registrar tu jornada sin compartir tu ubicación y el registro queda igual de válido. Para mostrar el nombre del lugar, ese punto se consulta a OpenStreetMap; si no respondes, guardamos solo las coordenadas.";

export function validateWorkCheckIn(
  values: WorkCheckInFormValues,
): WorkCheckInFormErrors {
  const errors: WorkCheckInFormErrors = {};
  const site = values.siteName.trim();
  const activity = values.activityDescription.trim();

  if (site.length < SITE_MIN) errors.siteName = "Indica el sitio o frente de trabajo.";
  else if (site.length > SITE_MAX) errors.siteName = `El sitio puede tener hasta ${SITE_MAX} caracteres.`;

  if (activity.length < ACTIVITY_MIN) errors.activityDescription = "Describe la actividad que estás realizando.";
  else if (activity.length > ACTIVITY_MAX) errors.activityDescription = `La actividad puede tener hasta ${ACTIVITY_MAX} caracteres.`;

  // Solo aplica cuando la empresa cambia la política a obligatoria (ADR-110).
  if (ATTENDANCE_MAP_REQUIREMENT === "required" && !values.location) {
    errors.maps = "Pulsa el botón de ubicación para registrar tu jornada.";
  }

  return errors;
}