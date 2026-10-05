export const projectTypeOptions = [
  { value: "obra", label: "Obra", prefix: "OBRA" },
  { value: "mantenimiento", label: "Mantenimiento", prefix: "MANT" },
  { value: "alquiler", label: "Alquiler", prefix: "ALQ" },
  { value: "otro", label: "Otro", prefix: "OTRO" },
] as const;

export type ProjectType = (typeof projectTypeOptions)[number]["value"];

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

