"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadWorkCheckInWorkspaceData,
  registerWorkCheckIn,
} from "../data/work-check-in-repository";
import { bogotaToday } from "../domain/attendance-period";
import {
  describePlace,
  isAppleDevice,
  mapsLink,
  readLocationOnce,
  type LocationErrorKind,
} from "@/shared/utils/geolocation";
import {
  ACTIVITY_MAX,
  LOCATION_CONSENT_TEXT,
  SITE_MAX,
  validateWorkCheckIn,
  type DeclaredLocationRecord,
  type WorkCheckInFormErrors,
  type WorkCheckInWorkspaceData,
} from "../domain/work-check-in";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

function CheckInIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function WorkCheckInWorkspace() {
  const [data, setData] = useState<WorkCheckInWorkspaceData | null>(null);
  const [projectId, setProjectId] = useState("");
  const [siteName, setSiteName] = useState("");
  const [activity, setActivity] = useState("");
  const [fieldErrors, setFieldErrors] = useState<WorkCheckInFormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState<DeclaredLocationRecord | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [locationState, setLocationState] = useState<"idle" | "shared" | "error">("idle");
  const [locationMessage, setLocationMessage] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const mapButtonRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await loadWorkCheckInWorkspaceData();
      setData(next);
      if (!next) setError("Inicia sesión para registrar tu jornada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar el registro de jornada.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const today = bogotaToday();
  const myTodayCheckIn = useMemo(
    () => data?.checkIns.find((item) => item.localDate === today),
    [data, today],
  );
  const disabled = isLoading || isSaving || !data?.employeeName;

  function chooseProject(value: string) {
    setProjectId(value);
    // El sitio se propone con la ubicación de la obra, pero queda editable: el
    // frente real puede ser distinto al domicilio de la obra.
    const project = data?.projects.find((item) => item.id === value);
    if (project?.location) setSiteName(project.location);
  }

  /**
   * Comparte la ubicación una sola vez, solo si la persona pulsa el botón.
   *
   * Antes de leer nada se muestra el texto de consentimiento. Si el GPS está
   * apagado o el permiso se deniega, se explica qué hacer y el registro se
   * puede completar igual: la ubicación nunca es un requisito.
   */
  async function shareLocation() {
    setIsLocating(true);
    setLocationState("idle");
    setLocationMessage(LOCATION_CONSENT_TEXT);

    const result = await readLocationOnce();
    if (!result.ok) {
      setLocationState("error");
      setLocationMessage(result.message);
      setIsLocating(false);
      return;
    }

    const label = await describePlace(result.latitude, result.longitude);
    const declared: DeclaredLocationRecord = {
      latitude: result.latitude,
      longitude: result.longitude,
      accuracyMeters: result.accuracyMeters,
      label,
    };
    setLocation(declared);
    setLocationState("shared");
    setIsLocating(false);

    const approx = result.accuracyMeters ? ` con una precisión de ${result.accuracyMeters} m` : "";
    setLocationMessage(
      label
        ? `Ubicación compartida: ${label}${approx}. Si te equivocaste, pulsa Quitar y vuelve a activarla.`
        : `Ubicación compartida${approx}. Si te equivocaste, pulsa Quitar y vuelve a activarla.`,
    );

    // El sitio se propone con el lugar detectado, pero la persona lo puede cambiar.
    if (!siteName.trim() && label) setSiteName(label);
  }

  function clearLocation() {
    setLocation(undefined);
    setLocationState("idle");
    setLocationMessage(LOCATION_CONSENT_TEXT);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setMessage("");
    setError("");

    const nextErrors = validateWorkCheckIn({ projectId, siteName, activityDescription: activity, location });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.maps) {
        setError(nextErrors.maps);
        mapButtonRef.current?.focus();
        return;
      }
      setError("");
      const firstField = nextErrors.siteName ? "check-in-site" : "check-in-activity";
      formRef.current?.querySelector<HTMLElement>(`#${firstField}`)?.focus();
      return;
    }
    setError("");

    setIsSaving(true);
    try {
      await registerWorkCheckIn(projectId, siteName.trim(), activity.trim(), location);
      setActivity("");
      setProjectId("");
      setLocation(undefined);
      setLocationState("idle");
      setLocationMessage(LOCATION_CONSENT_TEXT);
      setMessage(
        "Registro guardado. La hora corresponde al servidor y solo se conserva lo que declaraste.",
      );
      await refresh();
      successRef.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar el registro.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="attendance-layout" aria-busy={isLoading}>
      <form ref={formRef} className="attendance-form dashboard-panel" noValidate onSubmit={submit}>
        <div className="attendance-panel-heading">
          <div>
            <p>Mi declaración</p>
            <h2>{data?.employeeName ? `Hola, ${data.employeeName}` : "Registra tu llegada"}</h2>
          </div>
          <span aria-hidden="true" className="attendance-mark">
            <CheckInIcon />
          </span>
        </div>
        <p className="attendance-helper">
          Elige la obra si aplica y escribe el sitio real donde estás trabajando. Este dato queda como
          soporte de la jornada.
        </p>

        {!isLoading && !data?.employeeName ? (
          <p className="attendance-alert attendance-alert--error" role="alert">
            Tu cuenta aún no está asociada a un empleado activo. Pide a administración que la vincule.
          </p>
        ) : null}

        <label className="attendance-field" htmlFor="check-in-project">
          <span className="attendance-field-caption">
            Obra o proyecto <em>(opcional)</em>
          </span>
          <select
            disabled={disabled}
            id="check-in-project"
            onChange={(event) => chooseProject(event.target.value)}
            value={projectId}
          >
            <option value="">Sin obra asociada</option>
            {data?.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>
        </label>

        <label className="attendance-field" htmlFor="check-in-site">
          <span className="attendance-field-caption">
            Sitio o frente de trabajo <b aria-hidden="true">*</b>
          </span>
          <input
            aria-describedby="check-in-site-help"
            aria-invalid={fieldErrors.siteName ? true : undefined}
            autoComplete="organization"
            disabled={disabled}
            id="check-in-site"
            maxLength={SITE_MAX}
            onChange={(event) => {
              setSiteName(event.target.value);
              if (fieldErrors.siteName) setFieldErrors((prev) => ({ ...prev, siteName: undefined }));
            }}
            placeholder="Ej. Dique 3, área de tubería"
            value={siteName}
          />
          {fieldErrors.siteName ? (
            <span className="attendance-field-error" id="check-in-site-error">
              {fieldErrors.siteName}
            </span>
          ) : null}
        </label>

        <div className="attendance-location">
          <div className="attendance-location-head">
            <span className="attendance-location-title">
              <MapPinIcon />
              Mi ubicación
              <span className="attendance-optional">Opcional</span>
            </span>
            {location ? (
              <button
                className="attendance-location-clear"
                onClick={clearLocation}
                title="Quitar la ubicación de este registro"
                type="button"
              >
                Quitar
              </button>
            ) : null}
          </div>

          <p className="attendance-field-help" id="check-in-site-help">
            {locationMessage || LOCATION_CONSENT_TEXT}
          </p>

          <div className="attendance-location-actions">
            <button
              aria-describedby="check-in-site-help"
              className="attendance-map-button"
              disabled={disabled || isLocating}
              onClick={() => void shareLocation()}
              ref={mapButtonRef}
              title="Compartir mi ubicación una vez (opcional)"
              type="button"
            >
              <MapPinIcon />
              <span className="attendance-map-button-text">
                {isLocating ? "Buscando tu ubicación…" : location ? "Actualizar mi ubicación" : "Activar mi ubicación"}
              </span>
            </button>

            {location ? (
              <a
                className="attendance-location-link"
                href={mapsLink(location.latitude, location.longitude, isAppleDevice())}
                rel="noopener noreferrer"
                target="_blank"
              >
                Abrir en el mapa
              </a>
            ) : null}
          </div>

          {locationState === "shared" && location ? (
            <p aria-live="polite" className="attendance-location-result" data-state="ok">
              <strong>Ubicación registrada.</strong>{" "}
              {location.label ? `${location.label}. ` : ""}
              Punto {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              {location.accuracyMeters ? ` · precisión ${location.accuracyMeters} m` : ""}.
            </p>
          ) : null}

          {locationState === "error" ? (
            <p aria-live="assertive" className="attendance-location-result" data-state="error" role="alert">
              {locationMessage}
            </p>
          ) : null}
        </div>

        <label className="attendance-field" htmlFor="check-in-activity">
          <span className="attendance-field-caption">
            Actividad realizada <b aria-hidden="true">*</b>
          </span>
          <textarea
            aria-describedby={fieldErrors.activityDescription ? "check-in-activity-error" : undefined}
            aria-invalid={fieldErrors.activityDescription ? true : undefined}
            disabled={disabled}
            id="check-in-activity"
            maxLength={ACTIVITY_MAX}
            onChange={(event) => {
              setActivity(event.target.value);
              if (fieldErrors.activityDescription)
                setFieldErrors((prev) => ({ ...prev, activityDescription: undefined }));
            }}
            placeholder="Ej. Retiro de ductería y clasificación de material"
            rows={4}
            value={activity}
          />
          {fieldErrors.activityDescription ? (
            <span className="attendance-field-error" id="check-in-activity-error">
              {fieldErrors.activityDescription}
            </span>
          ) : null}
        </label>

        <button className="attendance-submit" disabled={disabled} type="submit">
          {isSaving ? "Guardando registro…" : "Registrar mi jornada"}
        </button>

        <p className="attendance-privacy">
          Se guarda quién declaró la información, la hora del servidor, el sitio y la actividad. La
          ubicación se lee únicamente si pulsas el botón: una sola vez, en ese momento, y nunca de
          forma automática. Si no la compartes, tu registro se guarda igual y es igual de válido.
        </p>

        {error ? (
          <p className="attendance-alert attendance-alert--error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p
            className="attendance-alert attendance-alert--success"
            role="status"
            aria-live="polite"
            ref={successRef}
            tabIndex={-1}
          >
            {message}
          </p>
        ) : null}
      </form>

      <section className="attendance-history dashboard-panel" aria-labelledby="attendance-history-title">
        <div className="attendance-panel-heading">
          <div>
            <p>{data?.canReview ? "Consulta operativa" : "Mi historial"}</p>
            <h2 id="attendance-history-title">
              {data?.canReview ? "Registros recientes del equipo" : "Tus registros recientes"}
            </h2>
          </div>
        </div>

        <div className="attendance-today">
          {myTodayCheckIn ? (
            <>
              <span className="attendance-tag attendance-tag--ok">Ya declaraste hoy</span>
              <span>
                {dateTimeFormatter.format(new Date(myTodayCheckIn.checkedInAt))} · {myTodayCheckIn.siteName}
              </span>
            </>
          ) : (
            <>
              <span className="attendance-tag">Sin registro hoy</span>
              <span>Cuando llegues, registra tu jornada con el botón de arriba.</span>
            </>
          )}
        </div>

        {isLoading ? <p className="attendance-helper">Cargando registros…</p> : null}
        {!isLoading && !data?.checkIns.length ? (
          <p className="attendance-empty">
            Aún no hay declaraciones. La primera aparecerá aquí al guardar tu registro.
          </p>
        ) : null}

        <ol className="attendance-records">
          {data?.checkIns.map((record) => (
            <li key={record.id}>
              <div className="attendance-record-meta">
                <strong>{record.employeeName}</strong>
                <time dateTime={record.checkedInAt}>{dateTimeFormatter.format(new Date(record.checkedInAt))}</time>
              </div>
              <p>{record.activityDescription}</p>
              <span>
                {record.projectLabel ? `${record.projectLabel} · ` : ""}
                {record.siteName}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}