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
  deliverySignatureDataUrl?: string;
  returnSignatureDataUrl?: string;
};

export const sampleInitialToolLoans: ToolLoan[] = [];
