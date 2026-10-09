"use client";

import type { LaborCostParameter } from "@/shared/labor-cost-parameters";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import styles from "./labor-project-modal.module.css";
import {
  computeProjectLabor,
  daysBetween,
  defaultHours,
  defaultLodgingDays,
  emptyPerDiem,
  perDiemConcepts,
  type HoursInput,
  type PerDiemKey,
  type ProjectPerDiemValues,
  type QuoteLaborSnapshot,

  diasTablaOficial,
  horasOficialExtraDiurnas,
  horasOficialDominicales,} from "../domain/project-labor";

type Entry = {
  id: string;
  code: string;
  name: string;
  level: number | null;
  daily_basic_salary: number;
  transport_allowance: number;
  food_allowance: number;
  non_salary_allowance: number;
  total_daily_rate: number;
  /** Dotacion total del perfil para 240 dias, tomada del cliente. */
  dotacion_total: number | null;
};

export type ProjectLaborDraft = {
  dias: number;
  diasAlojamiento: number;
  fechaInicio?: string;
  fechaFin?: string;
  perDiem: ProjectPerDiemValues;
  hours: HoursInput;
  /** Personal por código de cargo. */
  personal: Record<string, number>;
  dotacion: Record<string, number>;
  /** Solo los cargos que el usuario dejó marcados. */
  incluidos: string[];
  viaticos: Record<string, boolean>;
  viaticReasons: Record<string, string>;
  snapshot: QuoteLaborSnapshot;
};

const money = (value: number) =>
  `$ ${Math.round(value).toLocaleString("es-CO")}`;

/** Horas del mes en cero: el modal no supone nada al abrirse. */
const emptyHours: HoursInput = {
  horasExtraDiurnas: 0,
  horasExtraNocturnas: 0,
  horasDominicales: 0,
};

/**
 * Escala las horas de la tabla oficial al plazo de la obra.
 *
 * La hoja del cliente trae 56 horas extra diurnas y 14 dominicales para
 * 240 dias. Para una obra de N dias se aplica la misma proporcion, de
 * modo que el costo diario no cambie por tener mas o menos dias.
 */
function escalarHoras(dias: number): HoursInput {
  if (dias <= 0) return emptyHours;
  const factor = dias / diasTablaOficial;
  return {
    horasExtraDiurnas: Math.round(horasOficialExtraDiurnas * factor),
    horasExtraNocturnas: 0,
    horasDominicales: Math.round(horasOficialDominicales * factor),
  };
}

export function LaborProjectModal({
  tableId,
  tableName,
  scale,
  onClose,
  onSave,
}: {
  tableId: string;
  tableName: string;
  scale: "general" | "propias" | "no_propias";
  onClose: () => void;
  onSave: (draft: ProjectLaborDraft) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [dias, setDias] = useState(0);
  const [diasTocados, setDiasTocados] = useState(false);
  const [diasAlojamiento, setDiasAlojamiento] = useState(0);
  const [perDiem, setPerDiem] = useState<ProjectPerDiemValues>(emptyPerDiem());
  const [hours, setHours] = useState<HoursInput>(emptyHours);
  const [personal, setPersonal] = useState<Record<string, number>>({});
  const [dotacion, setDotacion] = useState<Record<string, number>>({});
  const [incluidos, setIncluidos] = useState<string[]>([]);
  const [viaticos, setViaticos] = useState<Record<string, boolean>>({});
  const [viaticReasons, setViaticReasons] = useState<Record<string, string>>({});
  const [laborParameters, setLaborParameters] = useState<LaborCostParameter[]>([]);
  const [cargandoParametros, setCargandoParametros] = useState(true);

  useEffect(() => {
    if (!tableId || !supabaseUrl || !supabasePublishableKey) return;
    const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
    void supabase
      .from("labor_rate_entries")
      .select(
        "id,code,name,level,daily_basic_salary,transport_allowance,food_allowance,non_salary_allowance,total_daily_rate,dotacion_total",
      )
      .eq("labor_rate_table_id", tableId)
      .order("sort_order")
      .eq("scale", scale)
      .order("name")
      .then(async ({ data, error: loadError }) => {
        if (loadError) {
          setError(loadError.message);
        } else {
          const baseEntries = (data ?? []) as Entry[];
          const { data: roleRows, error: rolesError } = await supabase
            .from("labor_rate_roles")
            .select("id,code,name,labor_rate_entry_id")
            .eq("labor_rate_table_id", tableId)
            .eq("is_active", true)
            .eq("scale", scale)
            .order("name");
          if (rolesError) setError(rolesError.message);
          const byEntry = new Map(baseEntries.map((entry) => [entry.id, entry]));
          const roleEntries = (roleRows ?? []).flatMap((role) => {
            const rate = byEntry.get(role.labor_rate_entry_id);
            return rate ? [{ ...rate, id: role.id, code: role.code, name: role.name }] : [];
          });
          const filas = (data ?? []) as Entry[];
          setEntries(filas);
          // La dotacion del perfil ya viene calculada desde la tabla del
          // cliente. Se propone como punto de partida y queda editable.
          const inicial: Record<string, number> = {};
          filas.forEach((fila) => {
            if (fila.dotacion_total) inicial[fila.code] = Number(fila.dotacion_total);
          });
          setDotacion(inicial);
        }
        setCargando(false);
      });
  }, [tableId, scale]);

  /* Los días salen del plazo, pero quedan editables a mano. */
  const diasDelPlazo = useMemo(
    () => daysBetween(fechaInicio, fechaFin),
    [fechaInicio, fechaFin],
  );

  useEffect(() => {
    if (!supabaseUrl || !supabasePublishableKey) return;
    const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
    void supabase
      .from("labor_cost_parameters")
      .select("code,label,rate,calculation_base,operation,divisor,description,sort_order,is_active,updated_at")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error: parameterError }) => {
        if (parameterError) {
          setError(parameterError.message);
        } else if (!data?.length) {
          setError("No hay parametros laborales vigentes configurados.");
        } else {
          setLaborParameters(data.map((item) => ({
          code: item.code,
          label: item.label,
          rate: Number(item.rate),
          calculationBase: item.calculation_base,
          operation: item.operation,
          divisor: Number(item.divisor),
          description: item.description,
          sortOrder: item.sort_order,
          isActive: item.is_active,
          updatedAt: item.updated_at,
        })) as LaborCostParameter[]);
        }
        setCargandoParametros(false);
      });
  }, []);

  /* Al elegir las fechas se calculan los días de la obra y, con esa misma
     proporción, las horas del mes. La tabla oficial trae 56 horas extra
     diurnas y 14 dominicales para 240 días; una obra de otro plazo se
     escala en esa razón. Todo queda editable porque es una estimación. */
  useEffect(() => {
    if (diasDelPlazo === null) return;
    setDias(diasDelPlazo);
    setDiasAlojamiento(defaultLodgingDays(diasDelPlazo));
    setHours(escalarHoras(diasDelPlazo));
    setDiasTocados(false);
  }, [diasDelPlazo]);

  /* Si el usuario escribe los días a mano, el alojamiento y las horas
     siguen la misma proporción para no quedar con valores que no calzan. */
  function cambiarDias(valor: number) {
    setDias(valor);
    setDiasTocados(true);
    setDiasAlojamiento(defaultLodgingDays(valor));
    setHours(escalarHoras(valor));
  }

  const resultados = useMemo(
    () =>
      cargandoParametros
        ? []
        : incluidos
        .map((code) => {
          const entry = entries.find((e) => e.code === code);
          if (!entry) return null;
          return computeProjectLabor({
            nombre: entry.name,
            codigo: entry.code,
            nivel: entry.level,
            salarioDia: Number(entry.daily_basic_salary),
            transporteAuxilio: Number(entry.transport_allowance),
            alimentacionAuxilioDia: Number(entry.food_allowance),
            noSalarialDia: Number(entry.non_salary_allowance),
            personal: personal[code] ?? 1,
            dias,
            diasAlojamiento,
            dotacion: dotacion[code] ?? 0,
            hours,
            perDiem,
            aplicaViaticos: viaticos[code] ?? /capataz|conductor/i.test(entry.name),
          }, laborParameters);
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [entries, incluidos, personal, dias, diasAlojamiento, dotacion, hours, perDiem, viaticos, laborParameters],
  );

  const totalObra = resultados.reduce((sum, r) => sum + r.totalPeriodo, 0);

  function alternar(code: string) {
    setIncluidos((current) =>
      current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code],
    );
  }

  function guardar() {
    if (resultados.length === 0) return;
    const exception = resultados.find((result) => {
      const isDefault = /capataz|conductor/i.test(result.input.nombre);
      const applies = viaticos[result.input.codigo ?? ""] ?? isDefault;
      return applies && !isDefault && !viaticReasons[result.input.codigo ?? ""]?.trim();
    });
    if (exception) {
      setError(`Indique por que ${exception.input.nombre} requiere viaticos de desplazamiento.`);
      return;
    }
    onSave({
      dias,
      diasAlojamiento,
      fechaInicio: fechaInicio || undefined,
      fechaFin: fechaFin || undefined,
      perDiem,
      hours,
      personal,
      dotacion,
      incluidos,
      viaticos,
      viaticReasons,
      snapshot: {
        dias,
        escala: scale,
        diasAlojamiento,
        calculadoEn: new Date().toISOString(),
        tablaId: tableId,
        tablaNombre: tableName,
        tabla: resultados.map((r) => {
          const entry = entries.find((e) => e.code === r.input.codigo);
          return {
            id: entry?.id,
            code: r.input.codigo ?? "",
            name: r.input.nombre,
            level: r.input.nivel ?? null,
            dailyBasicSalary: r.input.salarioDia,
            transportAllowance: r.input.transporteAuxilio,
            foodAllowance: r.input.alimentacionAuxilioDia,
            nonSalaryAllowance: r.input.noSalarialDia,
          };
        }),
        perDiem,
        viaticos,
        viaticReasons,
        hours,
        parametrosCostoLaboral: laborParameters,
        resultados: resultados.map((r) => ({
          codigo: r.input.codigo ?? "",
          nombre: r.input.nombre,
          personal: r.input.personal,
          valorDia: Math.round(r.valorDia),
          totalPeriodo: Math.round(r.totalPeriodo),
        })),
        totalObra: Math.round(totalObra),
      },
    });
  }

  return (
    <div className={styles["labor-project-backdrop"]} role="dialog" aria-modal="true">
      <div className={styles["labor-project-modal"]}>
        <header className={styles["labor-project-head"]}>
          <h3>Mano de obra de esta obra</h3>
          <p>
            Tabla <strong>{tableName}</strong>. Estos valores son solo para esta
            cotización: no cambian la tabla oficial ni ninguna otra cotización.
          </p>
          <button
            type="button"
            className={styles["labor-project-close"]}
            onClick={onClose}
          >
            Cerrar
          </button>
        </header>
        <div className={styles["labor-project-scroll"]}>

        {error ? (
          <p className="settings-notice" role="alert">
            {error}
          </p>
        ) : null}

        {/* ── Plazo de la obra ── */}
        <section className={styles["labor-project-block"]}>
          <h4>Plazo de la obra</h4>
          <div className={styles["labor-project-grid"]}>
            <label>
              Fecha de inicio
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </label>
            <label>
              Fecha de finalización
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </label>
            <label>
              Días de la obra
              <input
                type="number"
                min={1}
                value={dias}
                onChange={(e) => {
                  cambiarDias(Number(e.target.value) || 0);
                }}
              />
            </label>
            <label>
              Días de alojamiento
              <input
                type="number"
                min={0}
                value={diasAlojamiento}
                onChange={(e) => setDiasAlojamiento(Number(e.target.value) || 0)}
              />
            </label>
          </div>
          <p className={styles["labor-project-note"]}>
            {diasDelPlazo === null
              ? "Con las dos fechas los días se calculan solos. Si escribe un número a mano, se respeta el suyo."
              : `El plazo da ${diasDelPlazo} días. ${diasTocados ? "Está usando el valor que escribió a mano." : "Puede cambiarlo si el plazo no aplica."}`}
          </p>
        </section>

        {/* ── Horas ── */}
        <section className={styles["labor-project-block"]}>
          <h4>Horas del mes</h4>
          <div className={styles["labor-project-grid"]}>
            <label>
              Horas extra diurnas
              <input
                type="number"
                min={0}
                value={hours.horasExtraDiurnas}
                onChange={(e) =>
                  setHours({ ...hours, horasExtraDiurnas: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label>
              Horas extra nocturnas
              <input
                type="number"
                min={0}
                value={hours.horasExtraNocturnas}
                onChange={(e) =>
                  setHours({ ...hours, horasExtraNocturnas: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label>
              Horas dominicales
              <input
                type="number"
                min={0}
                value={hours.horasDominicales}
                onChange={(e) =>
                  setHours({ ...hours, horasDominicales: Number(e.target.value) || 0 })
                }
              />
            </label>
          </div>
          <p className={styles["labor-project-note"]}>
            Recargos: 25% diurna, 75% nocturna y 190% dominical. La hora ordinaria
            sale del salario día entre 7, como en la hoja oficial.
          </p>
        </section>

        {/* ── Conceptos por obra ── */}
        <section className={styles["labor-project-block"]}>
          <h4>Conceptos de esta obra</h4>
          <p className={styles["labor-project-note"]}>
            Los que tienen regla usan una tarifa por día y se multiplican por los
            días de alojamiento. Los demás se escriben como total del periodo.
          </p>
          <div className={styles["labor-project-grid"]}>
            {perDiemConcepts.map((concept) => (
              <label key={concept.key}>
                {concept.label}
                <input
                  type="number"
                  min={0}
                  value={perDiem[concept.key as PerDiemKey]}
                  onChange={(e) =>
                    setPerDiem({ ...perDiem, [concept.key]: Number(e.target.value) || 0 })
                  }
                />
                <small>{concept.mode === "regla" ? "tarifa por día" : "total del periodo"}</small>
              </label>
            ))}
          </div>
        </section>

        {/* ── Cargos de la obra ── */}
        <section className={styles["labor-project-block"]}>
          <h4>Cargos de esta obra</h4>
          {cargando ? (
            <p className={styles["labor-project-note"]}>Cargando cargos de la tabla…</p>
          ) : (
            <div className={styles["labor-project-entries"]}>
              {entries.map((entry) => {
                const activo = incluidos.includes(entry.code);
                const resultado = resultados.find((r) => r.input.codigo === entry.code);
                const viaticoPredeterminado = /capataz|conductor/i.test(entry.name);
                const aplicaViaticos = viaticos[entry.code] ?? viaticoPredeterminado;
                return (
                  <div key={entry.id} className={`${styles["labor-project-entry"]} ${activo ? "is-on" : ""}`}>
                    <label className={styles["labor-project-check"]}>
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => alternar(entry.code)}
                      />
                      <span>
                        <strong>{entry.code} · {entry.name}</strong>
                        <small>Valor oficial del nivel: {money(entry.total_daily_rate)} / día</small>
                      </span>
                    </label>
                    {activo ? (
                      <div className={styles["labor-project-entry-fields"]}>
                        <label>
                          Personal
                          <input
                            type="number"
                            min={1}
                            value={personal[entry.code] ?? 1}
                            onChange={(e) =>
                              setPersonal({
                                ...personal,
                                [entry.code]: Number(e.target.value) || 1,
                              })
                            }
                          />
                        </label>
                        <label>
                          Dotación total
                          <input
                            type="number"
                            min={0}
                            value={dotacion[entry.code] ?? 0}
                            onChange={(e) =>
                              setDotacion({
                                ...dotacion,
                                [entry.code]: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </label>
                        <label className={styles["labor-project-viatic"]}>
                          <input type="checkbox" checked={aplicaViaticos} onChange={(e) => setViaticos({ ...viaticos, [entry.code]: e.target.checked })} />
                          Hotel y transporte operativo
                          <small>{viaticoPredeterminado ? "Aplican por defecto a este cargo desplazado." : "Solo active si este cargo viaja al frente de obra."}</small>
                        </label>
                        {aplicaViaticos && !viaticoPredeterminado ? (
                          <label className={styles["labor-project-viatic-reason"]}>
                            Motivo de la excepcion
                            <input value={viaticReasons[entry.code] ?? ""} onChange={(e) => setViaticReasons({ ...viaticReasons, [entry.code]: e.target.value })} placeholder="Ej. desplazamiento temporal al frente" />
                          </label>
                        ) : null}
                        {resultado ? (
                          <p className={styles["labor-project-entry-total"]}>
                            <span>
                              {money(resultado.totalPeriodo)} por {dias} días
                            </span>
                            <strong>{money(resultado.valorDia)} / día</strong>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Desglose y total ── */}
        {resultados.length > 0 ? (
          <section className={styles["labor-project-block"]}>
            <h4>Cómo se arma el total</h4>
            <div className={styles["labor-project-table-wrap"]}>
              <table className={styles["labor-project-table"]}>
                <thead>
                  <tr>
                    <th>Cargo</th>
                    <th>Provisionado</th>
                    <th>Horas</th>
                    <th>Alimentación</th>
                    <th>No salarial</th>
                    <th>Conceptos</th>
                    <th>Dotación</th>
                    <th>Total periodo</th>
                    <th>Valor día</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => (
                    <tr key={r.input.codigo}>
                      <td>{r.input.nombre}</td>
                      <td>{money(r.subTotalProvisionado)}</td>
                      <td>{money(r.hours.subtotalHoras)}</td>
                      <td>{money(r.alimentacionTabla)}</td>
                      <td>{money(r.noSalarialPeriodo)}</td>
                      <td>{money(r.perDiemTotal)}</td>
                      <td>{money((r.input.dotacion ?? 0) * r.input.personal)}</td>
                      <td>{money(r.totalPeriodo)}</td>
                      <td>
                        <strong>{money(r.valorDia)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7}>Total de la mano de obra de la obra</td>
                    <td>{money(totalObra)}</td>
                    <td>
                      <strong>{money(dias > 0 ? totalObra / dias : 0)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        ) : null}

        </div>

        <footer className={styles["labor-project-foot"]}>
          <p>
            {incluidos.length === 0
              ? "Marque al menos un cargo para calcular."
              : `Total de ${incluidos.length} cargo${incluidos.length === 1 ? "" : "s"}: ${money(totalObra)}.`}
          </p>
          <div className={styles["labor-project-actions"]}>
            <button
              type="button"
              className={styles["labor-project-secondary"]}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles["labor-project-primary"]}
              disabled={resultados.length === 0}
              onClick={guardar}
            >
              Aplicar a esta cotización
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}