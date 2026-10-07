"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadAttendanceConsultation,
  loadAttendanceEmployees,
  loadAttendanceProjects,
} from "../data/work-check-in-repository";
import {
  attendancePeriodOptions,
  bogotaToday,
  buildAttendanceRollups,
  countPeriodDays,
  groupRecordsByDay,
  resolveAttendancePeriod,
  shiftAttendancePeriod,
  summarizeAttendance,
  type AttendancePeriodKind,
} from "../domain/attendance-period";
import type { AttendanceEmployee, AttendanceProject, WorkCheckIn } from "../domain/work-check-in";

const dayFormatter = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
const timeFormatter = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false });

function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {direction === "down" ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}
    </svg>
  );
}

export function AttendanceConsultation() {
  const [kind, setKind] = useState<AttendancePeriodKind>("day");
  const [anchor, setAnchor] = useState(() => bogotaToday());
  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [employees, setEmployees] = useState<AttendanceEmployee[]>([]);
  const [projects, setProjects] = useState<AttendanceProject[]>([]);
  const [records, setRecords] = useState<WorkCheckIn[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => resolveAttendancePeriod(kind, anchor), [kind, anchor]);

  useEffect(() => {
    void (async () => {
      try {
        const [employeeList, projectList] = await Promise.all([loadAttendanceEmployees(), loadAttendanceProjects()]);
        setEmployees(employeeList);
        setProjects(projectList);
      } catch {
        // Los filtros son auxiliares: si fallan, la tabla de registros sigue siendo útil.
      }
    })();
  }, []);

  // La búsqueda se aplica al dejar de escribir, para no lanzar una consulta por tecla.
  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setError("");
      const next = await loadAttendanceConsultation({
        kind,
        from: range.from,
        to: range.to,
        employeeId,
        projectId,
        search: appliedSearch,
      });
      setRecords(next);
    } catch {
      setError("No fue posible consultar las declaraciones del período.");
    } finally {
      setIsLoading(false);
    }
  }, [kind, range.from, range.to, employeeId, projectId, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const rollups = useMemo(() => buildAttendanceRollups(records, employees, range), [records, employees, range]);
  const summary = useMemo(() => summarizeAttendance(rollups, records), [rollups, records]);
  const daysInPeriod = countPeriodDays(range);
  const activeProject = projects.find((project) => project.id === projectId);

  function move(direction: 1 | -1) {
    setAnchor(shiftAttendancePeriod(kind, anchor, direction));
  }

  return (
    <div className="attendance-consultation">
      <div className="attendance-filters dashboard-panel" role="group" aria-label="Filtros de la consulta">
        <div className="attendance-filter-row">
          <div className="attendance-segments" role="tablist" aria-label="Período">
            {attendancePeriodOptions.map((option) => (
              <button
                aria-selected={kind === option.value}
                className="attendance-segment"
                key={option.value}
                onClick={() => {
                  setKind(option.value);
                  setAnchor(bogotaToday());
                }}
                role="tab"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="attendance-period-nav">
            <button
              aria-label="Período anterior"
              className="attendance-nav-button"
              onClick={() => move(-1)}
              title="Período anterior"
              type="button"
            >
              <ChevronIcon direction="up" />
            </button>
            <label className="attendance-nav-date" htmlFor="attendance-anchor">
              <span>{kind === "day" ? "Día" : kind === "week" ? "Semana" : "Mes"}</span>
              <input
                id="attendance-anchor"
                onChange={(event) => event.target.value && setAnchor(event.target.value)}
                type={kind === "month" ? "month" : "date"}
                value={anchor}
              />
            </label>
            <button
              aria-label="Período siguiente"
              className="attendance-nav-button"
              onClick={() => move(1)}
              title="Período siguiente"
              type="button"
            >
              <ChevronIcon direction="down" />
            </button>
          </div>
        </div>

        <div className="attendance-filter-grid">
          <label className="attendance-field" htmlFor="attendance-employee">
            Empleado
            <select id="attendance-employee" onChange={(event) => setEmployeeId(event.target.value)} value={employeeId}>
              <option value="">Todos los empleados</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                  {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="attendance-field" htmlFor="attendance-project">
            Obra o frente
            <select id="attendance-project" onChange={(event) => setProjectId(event.target.value)} value={projectId}>
              <option value="">Todas las obras</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
          </label>

          <label className="attendance-field" htmlFor="attendance-search">
            Buscar
            <input
              id="attendance-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Empleado, sitio o actividad"
              type="search"
              value={search}
            />
          </label>
        </div>

        <p className="attendance-filter-summary">
          <strong>{range.label}</strong> · {daysInPeriod} {daysInPeriod === 1 ? "día" : "días"}
          {activeProject ? ` · ${activeProject.label}` : ""}
        </p>
      </div>

      <div className="attendance-metrics">
        <div className="attendance-metric">
          <span>Empleados con declaración</span>
          <strong>{summary.employeesWithRecord}</strong>
        </div>
        <div className="attendance-metric">
          <span>Sin declaración en el período</span>
          <strong>{summary.employeesWithoutRecord}</strong>
        </div>
        <div className="attendance-metric">
          <span>Declaraciones registradas</span>
          <strong>{summary.totalRecords}</strong>
        </div>
        <div className="attendance-metric">
          <span>Obras o frentes con actividad</span>
          <strong>{summary.frontsWithActivity}</strong>
        </div>
      </div>

      {error ? (
        <p className="attendance-alert attendance-alert--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="attendance-results dashboard-panel" aria-busy={isLoading}>
        <div className="attendance-panel-heading">
          <div>
            <p>{kind === "day" ? "Registro del día" : kind === "week" ? "Resumen semanal" : "Consolidado mensual"}</p>
            <h2>{range.label}</h2>
          </div>
          <span className="attendance-results-count">
            {summary.totalRecords} {summary.totalRecords === 1 ? "declaración" : "declaraciones"}
          </span>
        </div>

        <p className="attendance-privacy-note">
          Registros de declaraciones del equipo. La ubicación se lee solo si el empleado la activa, y
          nunca se rastrea a nadie en segundo plano.
        </p>

        {isLoading ? <p className="attendance-helper">Consultando declaraciones…</p> : null}

        {!isLoading && !records.length ? (
          <p className="attendance-empty">No hay declaraciones registradas en este período.</p>
        ) : null}

        {!isLoading && records.length > 0 && kind === "day" ? (
          <div className="attendance-table-scroll">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th scope="col">Empleado</th>
                  <th scope="col">Hora</th>
                  <th scope="col">Obra o proyecto</th>
                  <th scope="col">Sitio o frente</th>
                  <th scope="col">Actividad reportada</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <th scope="row">{record.employeeName}</th>
                    <td className="attendance-cell-time">
                      <time dateTime={record.checkedInAt}>
                        {timeFormatter.format(new Date(record.checkedInAt))}
                      </time>
                    </td>
                    <td>{record.projectLabel ?? <span className="attendance-muted">Sin obra</span>}</td>
                    <td>{record.siteName}</td>
                    <td>{record.activityDescription}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !isLoading && records.length > 0 ? (
          <ul className="attendance-rollups">
            {rollups.map((row) => {
              const own = records.filter((record) => record.employeeId === row.employeeId);
              const grouped = groupRecordsByDay(own);
              const last = own[0];
              const open = expanded === row.employeeId;
              return (
                <li key={row.employeeId} className="attendance-rollup">
                  <button
                    aria-expanded={open}
                    className="attendance-rollup-head"
                    onClick={() => setExpanded(open ? null : row.employeeId)}
                    type="button"
                  >
                    <span className="attendance-rollup-name">
                      <strong>{row.employeeName}</strong>
                      {row.jobTitle ? <small>{row.jobTitle}</small> : null}
                    </span>
                    <span className="attendance-rollup-stats">
                      <span>
                        {row.daysWithRecord} {row.daysWithRecord === 1 ? "día con registro" : "días con registro"}
                      </span>
                      <span>
                        {row.totalRecords} {row.totalRecords === 1 ? "declaración" : "declaraciones"}
                      </span>
                      {kind === "month" ? (
                        <span>
                          {row.fronts} {row.fronts === 1 ? "frente reportado" : "frentes reportados"}
                        </span>
                      ) : null}
                    </span>
                    <span className="attendance-tag" data-state={row.daysWithRecord > 0 ? "ok" : "empty"}>
                      {row.daysWithRecord > 0 ? "Con declaración" : "Sin declaración"}
                    </span>
                    <span aria-hidden="true" className="attendance-rollup-chevron">
                      <ChevronIcon direction={open ? "up" : "down"} />
                    </span>
                  </button>

                  {row.daysWithRecord > 0 && !open ? (
                    <p className="attendance-rollup-latest">
                      Último sitio reportado: <strong>{last?.siteName}</strong>
                      <br />
                      Última actividad: <strong>{last?.activityDescription}</strong>
                    </p>
                  ) : null}

                  {open ? (
                    <div className="attendance-rollup-detail">
                      {grouped.map((day) => (
                        <section key={day.date}>
                          <h3>{dayFormatter.format(new Date(`${day.date}T12:00:00Z`))}</h3>
                          <ul>
                            {day.records.map((record) => (
                              <li key={record.id}>
                                <span className="attendance-record-time">
                                  {timeFormatter.format(new Date(record.checkedInAt))}
                                </span>
                                <span>
                                  {record.projectLabel ? <strong>{record.projectLabel}</strong> : null}
                                  <em>{record.siteName}</em>
                                  <p>{record.activityDescription}</p>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}