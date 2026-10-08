export type LaborActivityType = "propias" | "no_propias";

export type LaborPosition = {
  id: string;
  code: string;
  name: string;
  activityType: LaborActivityType;
  /** Escala dentro de la tabla del cliente. Opcional: el respaldo local no la distingue. */
  scale?: "general" | "propias" | "no_propias";
  specialty: string;
  specialtyLabel: string;
  level: number;
  dailyBasicSalary: number;
  transportAllowance: number;
  foodAllowance: number;
  nonSalaryAllowance: number;
  /** Costo real que consume el APU: valor oficial mas provisiones y horas. */
  totalDailyRate: number;
  /** Valor dia oficial de la empresa, solo informativo. No se cobra. */
  officialDailyRate: number;
  /** Provisiones diarias calculadas por RFC. */
  provisionDaily: number;
  /** Horas extra diurnas, nocturnas y dominicales prorrateadas al dia. */
  extraHoursDaily: number;
  validFrom: string;
  validTo: string;
  sourceDocument: string;
  summary: string;
  receivesHotel?: boolean;
  receivesOperationalTransport?: boolean;
};

export type LaborPositionCatalog = {
  positions: LaborPosition[];
  source: "database" | "fallback";
  warning?: string;
};
