export type Project = {
  id: string;
  code: string;
  name: string;
  client: string;
  location: string;
  budget: number; // Presupuesto estimado de materiales en COP
  status: "pending" | "active" | "completed" | "on_hold";
  createdAt: string;
  startDate?: string; // Fecha de inicio de obra
  estimatedEndDate?: string; // Fecha final tentativa / entrega estimada
};

export const initialProjects: Project[] = [
  {
    id: "prj-01",
    code: "OBRA-2026-01",
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
