"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  changeWorkdaySegment,
  finishWorkday,
  loadCurrentWorkday,
  loadMyWorkdaySegments,
  loadWorkCheckInWorkspaceData,
  startWorkday,
} from "../data/work-check-in-repository";
import { describePlace, isAppleDevice, mapsLink, mapsSearchLink, readLocationOnce } from "@/shared/utils/geolocation";
import {
  ACTIVITY_MAX,
  LOCATION_CONSENT_TEXT,
  SITE_MAX,
  validateWorkCheckIn,
  type CurrentWorkday,
  type DeclaredLocationRecord,
  type WorkCheckInFormErrors,
  type WorkCheckInWorkspaceData,
  type WorkdaySegmentType,
  type WorkdaySegment,
} from "../domain/work-check-in";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

const segmentLabels: Record<WorkdaySegmentType, string> = {
  work: "Actividad de trabajo",
  travel: "Desplazamiento",
  break: "Pausa",
};

/** Etiquetas cortas para el botón principal: "Registrar actividad", no "de actividad de trabajo". */
const segmentActionLabels: Record<WorkdaySegmentType, string> = {
  work: "actividad",
  travel: "desplazamiento",
  break: "pausa",
};

export function WorkCheckInWorkspace() {
  const [data, setData] = useState<WorkCheckInWorkspaceData | null>(null);
  const [workday, setWorkday] = useState<CurrentWorkday | null>(null);
  const [segments, setSegments] = useState<WorkdaySegment[]>([]);
  const [projectId, setProjectId] = useState("");
  const [siteName, setSiteName] = useState("");
  const [activity, setActivity] = useState("");
  const [segmentType, setSegmentType] = useState<WorkdaySegmentType>("work");
  const [fieldErrors, setFieldErrors] = useState<WorkCheckInFormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState<DeclaredLocationRecord>();
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState(LOCATION_CONSENT_TEXT);
  const successRef = useRef<HTMLParagraphElement>(null);
  const activityRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [workspace, current, todaySegments] = await Promise.all([
        loadWorkCheckInWorkspaceData(),
        loadCurrentWorkday(),
        // La línea de tiempo es un extra: si falla, la jornada sigue registrable.
        loadMyWorkdaySegments().catch(() => [] as WorkdaySegment[]),
      ]);
      setData(workspace);
      setWorkday(current);
      setSegments(todaySegments);
      if (!workspace) setError("Inicia sesión para registrar tu jornada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar la jornada.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function chooseProject(value: string) {
    setProjectId(value);
    const project = data?.projects.find((item) => item.id === value);
    if (project?.location && !siteName.trim()) setSiteName(project.location);
  }

  async function shareLocation() {
    setIsLocating(true);
    setLocationMessage(LOCATION_CONSENT_TEXT);
    const result = await readLocationOnce();
    if (!result.ok) {
      setLocationMessage(result.message);
      setIsLocating(false);
      return;
    }
    const label = await describePlace(result.latitude, result.longitude);
    setLocation({ latitude: result.latitude, longitude: result.longitude, accuracyMeters: result.accuracyMeters, label });
    setLocationMessage(label ? `Ubicación compartida para este único registro: ${label}.` : "Ubicación compartida para este único registro.");
    if (!siteName.trim() && label) setSiteName(label);
    setIsLocating(false);
  }

  function prepareChange(type: WorkdaySegmentType) {
    setSegmentType(type);
    setProjectId(workday?.currentSegment?.projectId ?? "");
    setSiteName(workday?.currentSegment?.siteName ?? "");
    setActivity(type === "travel" ? "Desplazamiento hacia otro frente de trabajo" : "");
    setMessage("");
    setError("");
    setFieldErrors({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const errors = validateWorkCheckIn({ projectId, siteName, activityDescription: activity, location });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setIsSaving(true); setError(""); setMessage("");
    try {
      const input = { projectId, siteName: siteName.trim(), activityDescription: activity.trim(), location };
      if (!workday) {
        await startWorkday(input);
        setMessage("Entrada registrada. Puedes seguir agregando actividades a tu jornada; al salir, registra la salida.");
      } else {
        await changeWorkdaySegment(segmentType, input);
        setMessage(
          "Actividad registrada. Puedes seguir agregando más hasta que termines el día; cuando te retires, registra la salida.",
        );
      }
      setLocation(undefined); setLocationMessage(LOCATION_CONSENT_TEXT);
      // Se vacía la actividad y se deja el sitio listo: la siguiente labor se
      // escribe sin borrar nada a mano, que es como se trabaja en campo.
      setActivity("");
      await refresh();
      // Al terminar se enfoca la actividad para que el siguiente registro arranque de inmediato.
      activityRef.current?.focus();
      successRef.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar el tramo.");
    } finally { setIsSaving(false); }
  }

  async function finish() {
    if (isSaving) return;
    setIsSaving(true); setError(""); setMessage("");
    try {
      await finishWorkday(location);
      setLocation(undefined); setLocationMessage(LOCATION_CONSENT_TEXT);
      setMessage("Salida registrada. La jornada y su tramo activo quedaron cerrados.");
      await refresh(); successRef.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible finalizar la jornada.");
    } finally { setIsSaving(false); }
  }

  const disabled = isLoading || isSaving || !data?.employeeName;
  const hasOpenWorkday = workday?.status === "open";

  return (
    <section className="attendance-layout" aria-busy={isLoading}>
      <form className="attendance-form dashboard-panel" noValidate onSubmit={submit}>
        <div className="attendance-panel-heading">
          <div>
            <p>{hasOpenWorkday ? "Jornada en curso" : "Mi jornada"}</p>
            <h2>{data?.employeeName ? `Hola, ${data.employeeName}` : "Registra tu llegada"}</h2>
          </div>
          <span className="attendance-tag attendance-tag--ok">{hasOpenWorkday ? "Abierta" : "Sin iniciar"}</span>
        </div>

        {hasOpenWorkday && workday.currentSegment ? (
          <div className="attendance-current-segment">
            <strong>{segmentLabels[workday.currentSegment.type]}</strong>
            <span>{workday.currentSegment.siteName} · {workday.currentSegment.activityDescription}</span>
            <small>Abierto: {dateTimeFormatter.format(new Date(workday.currentSegment.startedAt))}</small>
          </div>
        ) : (
          <p className="attendance-helper">La entrada y la salida son obligatorias. Al iniciar, queda abierto tu primer tramo de trabajo.</p>
        )}

        {hasOpenWorkday ? (
          <fieldset className="attendance-action-options">
            <legend>¿Qué vas a registrar?</legend>
            {(["work", "travel", "break"] as WorkdaySegmentType[]).map((type) => (
              <button className={segmentType === type ? "is-active" : ""} key={type} onClick={() => prepareChange(type)} type="button">
                {segmentLabels[type]}
              </button>
            ))}
          </fieldset>
        ) : null}

        <label className="attendance-field" htmlFor="check-in-project">Obra o proyecto <em>(opcional)</em>
          <select disabled={disabled} id="check-in-project" onChange={(event) => chooseProject(event.target.value)} value={projectId}>
            <option value="">Sin obra asociada</option>
            {data?.projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
          </select>
        </label>
        <label className="attendance-field" htmlFor="check-in-site">Sitio o frente de trabajo <b aria-hidden="true">*</b>
          <input aria-invalid={fieldErrors.siteName ? true : undefined} disabled={disabled} id="check-in-site" maxLength={SITE_MAX} onChange={(event) => setSiteName(event.target.value)} placeholder="Ej. Bodega principal o Dique 3" value={siteName} />
          {fieldErrors.siteName ? <span className="attendance-field-error">{fieldErrors.siteName}</span> : null}
        </label>
        <label className="attendance-field" htmlFor="check-in-activity">Actividad realizada <b aria-hidden="true">*</b>
          <textarea aria-invalid={fieldErrors.activityDescription ? true : undefined} disabled={disabled} id="check-in-activity" ref={activityRef} maxLength={ACTIVITY_MAX} onChange={(event) => setActivity(event.target.value)} placeholder="Ej. Preparación de materiales y organización de bodega" rows={3} value={activity} />
          {fieldErrors.activityDescription ? <span className="attendance-field-error">{fieldErrors.activityDescription}</span> : null}
        </label>

        <div className="attendance-location">
          <div className="attendance-location-head"><span className="attendance-location-title">Ubicación <span className="attendance-optional">Opcional</span></span>{location ? <button className="attendance-location-clear" onClick={() => setLocation(undefined)} type="button">Quitar</button> : null}</div>
          <p className="attendance-field-help">{locationMessage} No se activa en segundo plano.</p>
          <div className="attendance-location-actions">
            <button className="attendance-map-button" disabled={disabled || isLocating} onClick={() => void shareLocation()} type="button">{isLocating ? "Buscando ubicación…" : location ? "Actualizar ubicación" : "Compartir mi ubicación"}</button>
            {/* Abrir el mapa siempre está disponible: con el punto capturado si lo hay,
                o con la búsqueda del sitio escrito. En el teléfono la resuelve la app instalada. */}
            <a
              className="attendance-location-link"
              href={
                location
                  ? mapsLink(location.latitude, location.longitude, isAppleDevice())
                  : mapsSearchLink(siteName, isAppleDevice())
              }
              rel="noopener noreferrer"
              target="_blank"
            >
              {location ? "Abrir el punto en el mapa" : "Abrir el sitio en el mapa"}
            </a>
          </div>
        </div>

        <button className="attendance-submit" disabled={disabled} type="submit">
          {isSaving
            ? "Guardando…"
            : hasOpenWorkday
              ? `Registrar ${segmentActionLabels[segmentType]}`
              : "Registrar entrada"}
        </button>
        {hasOpenWorkday ? (
          <button className="attendance-finish" disabled={disabled} onClick={() => void finish()} type="button">
            Registrar salida y finalizar jornada
          </button>
        ) : null}
        {hasOpenWorkday ? (
          <p className="attendance-continue-hint">
            Puedes registrar tantas actividades como necesites. El sitio queda listo para que solo
            escribas la siguiente labor; la salida se registra al final del día.
          </p>
        ) : null}
        <p className="attendance-privacy">La ubicación es voluntaria y puntual. La hora de entrada, cada cambio y la salida se toman del servidor. Si olvidas cerrar el día, quedará señalado para revisión, sin inventar una hora de salida.</p>
        {error ? <p className="attendance-alert attendance-alert--error" role="alert">{error}</p> : null}
        {message ? <p className="attendance-alert attendance-alert--success" ref={successRef} role="status" tabIndex={-1}>{message}</p> : null}
      </form>

      <section className="attendance-history dashboard-panel" aria-labelledby="attendance-history-title">
        <div className="attendance-panel-heading"><div><p>Seguimiento personal</p><h2 id="attendance-history-title">Tu jornada de hoy</h2></div></div>
        <div className="attendance-today">
          {hasOpenWorkday ? <><span className="attendance-tag attendance-tag--ok">Jornada abierta</span><span>Vas sumando actividades al día. Registra la salida cuando te retires.</span></> : workday ? <><span className="attendance-tag attendance-tag--ok">Jornada cerrada</span><span>Tu jornada de hoy quedó cerrada a las {workday.endedAt ? dateTimeFormatter.format(new Date(workday.endedAt)) : "—"}.</span></> : <><span className="attendance-tag">Pendiente</span><span>Registra tu entrada al llegar. La jornada no se completa solo con actividades.</span></>}
        </div>
        <p className="attendance-helper">El registro por tramos evita periodos sin explicación: usa “Desplazamiento” cuando cambies de frente y “Pausa” si aplica.</p>

        {segments.length ? (
          <ol className="attendance-timeline" aria-label="Actividades de hoy">
            {segments.map((segment) => (
              <li key={segment.id}>
                <time dateTime={segment.startedAt}>{segment.localTime}</time>
                <span className="attendance-timeline-body">
                  <strong>{segmentLabels[segment.type]}</strong>
                  <span>{segment.activityDescription}</span>
                  <small>{segment.siteName}</small>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        {/* La línea de tiempo ya muestra las labores del día; la lista de entradas solo
            aparece cuando todavía no hay tramos, para no repetir la misma información. */}
        {segments.length ? null : (
          <ol className="attendance-records">
            {data?.checkIns.slice(0, 8).map((record) => (
              <li key={record.id}>
                <div className="attendance-record-meta">
                  <strong>{record.employeeName}</strong>
                  <time dateTime={record.checkedInAt}>
                    {dateTimeFormatter.format(new Date(record.checkedInAt))}
                  </time>
                </div>
                <p>{record.activityDescription}</p>
                <span>
                  {record.projectLabel ? `${record.projectLabel} · ` : ""}
                  {record.siteName}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
