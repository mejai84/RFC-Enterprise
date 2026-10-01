export const projectTypeOptions = [
  { value: "obra", label: "Obra", prefix: "OBRA" },
  { value: "mantenimiento", label: "Mantenimiento", prefix: "MANT" },
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

export const initialProjects: Project[] = [
  {
    id: "prj-01",
    code: "OBRA-2026-01",
    type: "obra",
    name: "Construcción Estructura Metálica y Cubierta",
    client: "Alcaldía de Caucasia",
    location: "Caucasia, Antioquia",
    budget: 28500000,
    status: "active",
    createdAt: "2026-01-15",
    startDate: "2026-01-15",
    estimatedEndDate: "2026-06-30",
  },
  {
    id: "prj-02",
    code: "MANT-2026-04",
    type: "mantenimiento",
    name: "Mantenimiento Integral de Instalaciones Industriales",
    client: "Minera del Bajo Cauca S.A.S.",
    location: "El Bagre, Antioquia",
    budget: 15000000,
    status: "active",
    createdAt: "2026-02-01",
    startDate: "2026-02-01",
    estimatedEndDate: "2026-05-15",
  },
  {
    id: "prj-03",
    code: "OBRA-2026-02",
    type: "obra",
    name: "Adecuación Civil y Cerramiento Perimetral",
    client: "Consorcio Vial Antioquia",
    location: "Tarazá, Antioquia",
    budget: 9800000,
    status: "active",
    createdAt: "2026-02-20",
    startDate: "2026-02-20",
    estimatedEndDate: "2026-04-30",
  },
];
