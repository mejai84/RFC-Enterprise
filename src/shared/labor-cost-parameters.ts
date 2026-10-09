export type LaborCostCalculationBase =
  | "salario_transporte"
  | "cesantias"
  | "salario_transporte_mas_extras";

export type LaborCostOperation = "sumar" | "restar";

export type LaborCostParameter = {
  code: string;
  label: string;
  rate: number;
  calculationBase: LaborCostCalculationBase;
  operation: LaborCostOperation;
  divisor: number;
  description: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: string;
};

export const laborCostCalculationBases: Array<{ value: LaborCostCalculationBase; label: string }> = [
  { value: "salario_transporte", label: "Salario + auxilio de transporte" },
  { value: "cesantias", label: "Valor calculado de cesantias" },
  { value: "salario_transporte_mas_extras", label: "Salario + transporte + extras" },
];

