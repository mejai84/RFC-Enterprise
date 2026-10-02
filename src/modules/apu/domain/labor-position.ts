export type LaborActivityType = "propias" | "no_propias";

export type LaborPosition = {
  id: string;
  code: string;
  name: string;
  activityType: LaborActivityType;
  specialty: string;
  specialtyLabel: string;
  level: number;
  dailyBasicSalary: number;
  transportAllowance: number;
  foodAllowance: number;
  nonSalaryAllowance: number;
  totalDailyRate: number;
  validFrom: string;
  validTo: string;
  sourceDocument: string;
  summary: string;
};

export type LaborPositionCatalog = {
  positions: LaborPosition[];
  source: "database" | "fallback";
  warning?: string;
};
