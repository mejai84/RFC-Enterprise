export type ToolLoanStatus = "active" | "returned" | "damaged";

export type ToolLoan = {
  id: string;
  code: string; // PRST-2026-001
  toolId: string;
  toolName: string;
  workerName: string; // ej. Pedro Ramírez (Soldador)
  projectId: string;
  projectName: string;
  loanDate: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  status: ToolLoanStatus;
  notes?: string;
};

export const sampleInitialToolLoans: ToolLoan[] = [
  {
    id: "loan-01",
    code: "PRST-2026-001",
    toolId: "tool-01",
    toolName: "Pulidora Angular 7 Pulgadas DeWalt",
    workerName: "Pedro Ramírez (Soldador)",
    projectId: "prj-01",
    projectName: "Construcción Estructura Metálica y Cubierta",
    loanDate: "2026-03-10",
    expectedReturnDate: "2026-03-20",
    status: "active",
    notes: "Entregada con guarda de seguridad y mango lateral",
  },
  {
    id: "loan-02",
    code: "PRST-2026-002",
    toolId: "tool-02",
    toolName: "Equipo de Soldadura Inverter 200A",
    workerName: "Gabriel Restrepo (Operador)",
    projectId: "prj-02",
    projectName: "Mantenimiento Integral de Instalaciones Industriales",
    loanDate: "2026-03-08",
    expectedReturnDate: "2026-03-15",
    actualReturnDate: "2026-03-15",
    status: "returned",
    notes: "Devuelto en perfecto estado de funcionamiento",
  },
];
