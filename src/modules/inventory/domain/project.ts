import type { ProjectRentalTerms } from "./rental-project";

export const projectTypeOptions = [
  { value: "obra",            label: "Obra",               prefix: "OBRA", requiresQuote: true,  requiresApu: true,  description: "Construcción, adecuación o montaje con actividades costeables." },
  { value: "mantenimiento",   label: "Mantenimiento",      prefix: "MANT", requiresQuote: false, requiresApu: false, description: "Mantenimiento programado o correctivo, sin APU formal." },
  { value: "alquiler",        label: "Alquiler",           prefix: "ALQ",  requiresQuote: false, requiresApu: false, description: "Alquiler de equipos; tarifa por día/hora sin desglose APU." },
  { value: "emergencia",      label: "Emergencia",         prefix: "EMER", requiresQuote: false, requiresApu: false, description: "Reparación urgente; se ejecuta primero y se documenta después." },
  { value: "administracion",  label: "Por administración", prefix: "ADM",  requiresQuote: false, requiresApu: false, description: "Obra cobrada por gasto real de materiales + mano de obra." },
  { value: "consultoria",     label: "Consultoría / Diseño", prefix: "CONS", requiresQuote: false, requiresApu: false, description: "Diseño, trámite o servicio profesional con precio fijo." },
  { value: "otro",            label: "Otro",               prefix: "OTRO", requiresQuote: false, requiresApu: false, description: "Proyecto genérico que no encaja en las categorías anteriores." },
] as const;

export type ProjectType = (typeof projectTypeOptions)[number]["value"];

/** Verifica si un tipo de proyecto requiere APU para costear */
export function projectTypeRequiresApu(type: ProjectType): boolean {
  return projectTypeOptions.find((o) => o.value === type)?.requiresApu ?? false;
}

/** Verifica si un tipo de proyecto requiere cotización formal */
export function projectTypeRequiresQuote(type: ProjectType): boolean {
  return projectTypeOptions.find((o) => o.value === type)?.requiresQuote ?? false;
}

/** Obtiene la descripción del tipo de proyecto */
export function projectTypeDescription(type: ProjectType): string {
  return projectTypeOptions.find((o) => o.value === type)?.description ?? "";
}

/**
 * Deduce el tipo de proyecto a partir del consecutivo (OBRA-, MANT-, ALQ-, ...).
 * Evita que un proyecto de alquiler quede clasificado como "otro" al releerlo de la base de datos.
 */
export function projectTypeFromCode(code: string): ProjectType {
  const prefix = code.split("-")[0]?.toUpperCase() ?? "";
  return projectTypeOptions.find((o) => o.prefix === prefix)?.value ?? "otro";
}

export type AssignedProjectEmployee = {
  id: string;
  name: string;
  title: string;
};

export type Project = {
  id: string;
  code: string;
  type: ProjectType;
  name: string;
  client: string;
  location: string;
  budget: number; // Presupuesto estimado de materiales en COP
  status: "pending" | "active" | "completed" | "on_hold";
  createdAt: string;
  startDate?: string; // Fecha de inicio de obra
  estimatedEndDate?: string; // Fecha final tentativa / entrega estimada
  actualEndDate?: string; // Fecha real de entrega o finalización
  assignedEmployees?: AssignedProjectEmployee[];
  budgetAdjustments?: Array<{ id: string; amount: number; reason: string; responsible: string; occurredAt: string }>;
  /** Cotización de origen cuando la obra fue adjudicada desde el pipeline comercial. */
  sourceQuoteId?: string;
  sourceQuoteCode?: string;
  /** Condiciones de alquiler (ALQ-001); solo presente en proyectos tipo "alquiler". */
  rental?: ProjectRentalTerms;
};


export function getNextProjectCode(
  projects: ReadonlyArray<Pick<Project, "code">>,
  type: ProjectType,
  startDate: string,
) {
  const option = projectTypeOptions.find((item) => item.value === type)!;
  const dateSegment = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? startDate.replaceAll("-", "")
    : new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const codePattern = new RegExp(`^${option.prefix}-${dateSegment}-(\\d+)$`);
  const nextSequence = projects.reduce((highest, project) => {
    const match = project.code.match(codePattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;

  return `${option.prefix}-${dateSegment}-${String(nextSequence).padStart(2, "0")}`;
}

export const initialProjects: Project[] = [];

