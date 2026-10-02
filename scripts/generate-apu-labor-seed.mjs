import fs from "node:fs";
import ts from "typescript";

const [, , outputPath] = process.argv;
if (!outputPath) throw new Error("Indica la ruta de salida de la migración.");

const source = fs.readFileSync("src/modules/quotes/domain/ocensa-labor.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const runtimeModule = { exports: {} };
new Function("exports", "module", compiled)(runtimeModule.exports, runtimeModule);
const positions = runtimeModule.exports.ocensaLaborPositions;

const sqlString = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const sqlNumber = (value) => Number(value ?? 0).toFixed(2);
const sourceDocument = "TABLA SALARIAL LABORALES PARA CONTRATISTAS JUL2026-JUN2027.pdf";

const rows = positions.map((position) => {
  const validFrom = position.activityType === "propias" ? "2026-07-01" : "2026-01-01";
  const validTo = position.activityType === "propias" ? "2027-06-30" : "2026-12-31";
  return `    (${[
    sqlString(position.code),
    sqlString(position.name),
    sqlString(position.activityType),
    sqlString(position.specialty),
    sqlString(position.specialtyLabel),
    Number(position.level),
    sqlNumber(position.dailyBasicSalary),
    sqlNumber(position.transportAllowance),
    sqlNumber(position.foodAllowance),
    sqlNumber(position.nonSalaryAllowance),
    sqlNumber(position.totalDailyRate),
    sqlString(validFrom),
    sqlString(validTo),
    sqlString(sourceDocument),
    sqlString(position.summary),
  ].join(", ")})`;
});

const sql = `-- Semilla del tabulador salarial oficial usado por el selector de mano de obra del APU.
with labor_seed (
  code, name, activity_type, specialty, specialty_label, level,
  daily_basic_salary, transport_allowance, food_allowance, non_salary_allowance,
  total_daily_rate, valid_from, valid_to, source_document, summary
) as (
  values
${rows.join(",\n")}
)
insert into public.apu_labor_positions (
  company_id, code, name, activity_type, specialty, specialty_label, level,
  daily_basic_salary, transport_allowance, food_allowance, non_salary_allowance,
  total_daily_rate, valid_from, valid_to, source_document, summary
)
select
  company.id, labor_seed.code, labor_seed.name, labor_seed.activity_type,
  labor_seed.specialty, labor_seed.specialty_label, labor_seed.level,
  labor_seed.daily_basic_salary, labor_seed.transport_allowance,
  labor_seed.food_allowance, labor_seed.non_salary_allowance,
  labor_seed.total_daily_rate, labor_seed.valid_from::date, labor_seed.valid_to::date,
  labor_seed.source_document, labor_seed.summary
from public.companies company
cross join labor_seed
where company.slug = 'rfc'
on conflict (company_id, code, valid_from) do update set
  name = excluded.name,
  activity_type = excluded.activity_type,
  specialty = excluded.specialty,
  specialty_label = excluded.specialty_label,
  level = excluded.level,
  daily_basic_salary = excluded.daily_basic_salary,
  transport_allowance = excluded.transport_allowance,
  food_allowance = excluded.food_allowance,
  non_salary_allowance = excluded.non_salary_allowance,
  total_daily_rate = excluded.total_daily_rate,
  valid_to = excluded.valid_to,
  source_document = excluded.source_document,
  summary = excluded.summary,
  is_active = true;
`;

fs.writeFileSync(outputPath, sql, "utf8");
console.log(`Generados ${positions.length} cargos en ${outputPath}`);
