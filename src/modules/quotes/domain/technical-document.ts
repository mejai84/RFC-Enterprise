export const technicalDocumentTypes = ["work_procedure", "risk_matrix"] as const;
export type TechnicalDocumentType = (typeof technicalDocumentTypes)[number];
export type TechnicalDocumentStatus = "draft" | "sent" | "changes_requested" | "approved" | "superseded";

export type QuoteTechnicalDocument = {
  id: string;
  documentType: TechnicalDocumentType;
  version: number;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: TechnicalDocumentStatus;
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
  signedUrl?: string;
};

export const technicalDocumentLabels: Record<TechnicalDocumentType, string> = {
  work_procedure: "Procedimiento de trabajo",
  risk_matrix: "Matriz de peligros, riesgos y controles",
};
