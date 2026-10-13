"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { HelpHint } from "@/shared/help-hint";

/**
 * Editor de la matriz de dotacion por cargo.
 *
 * La fila de la matriz es el cargo, no el nivel. Un oficial y un ayudante
 * de paileria comparten nivel y pueden llevar cosa distinta: por eso cada
 * fila guarda la cantidad de ese cargo y si todavia es la plantilla del
 * nivel o ya se corrigio a mano.
 */

type Concepto = {
  id: string;
  name: string;
  unit: string;
  default_unit_value: number;
  category: string;
  source_name: string;
};

type Fila = {
  concept_id: string;
  quantity: number;
  /** Cada cuántos días se repone el concepto. Cero significa que la reposicion
   *  todavia no se ha definido: la cantidad se aplica una sola vez. */
  replacement_days: number;
  unit_value_override: number | null;
  inherited_from_level: boolean;
  notes: string;
};

type Rol = {
  id: string;
  code: string;
  name: string;
  scale: "general" | "propias" | "no_propias";
  specialty_label: string;
  labor_rate_entry_id: string;
  dotacion_total: number | null;
  dotacion_daily: number | null;
  computed_daily_cost: number | null;
  total_daily_rate: number | null;
  level: number | null;
};

type Tabla = {
  id: string;
  name: string;
  version: string;
  client_name: string;
};

const money = (v: number | null | undefined) =>
  v == null ? "—" : `$ ${Math.round(v).toLocaleString("es-CO")}`;

const escala = (s: Rol["scale"]) =>
  s === "propias" ? "Actividades propias" : s === "no_propias" ? "Actividades no propias" : "General";

/* El ano de referencia es el que usa la tabla del cliente para el promedio
   diario. Solo se usa para proyectar las reposiciones, no como supuesto de
   que todo se repone cada 240 dias. */
const ANIO_REFERENCIA = 240;

/* Cuantas veces se repone el concepto dentro del ano de referencia. Con la
   reposicion en cero no se repone ninguna: se aplica una sola vez. */
function repeticionesAnuales(replacementDays: number) {
  if (!replacementDays || replacementDays <= 0) return 1;
  const veces = ANIO_REFERENCIA / replacementDays;
  /* Un casco con reposicion de 2 anos no se repone dentro del ano, pero
     tampoco se puede pedir menos de la dotación inicial. */
  return Math.max(1, Math.round(veces * 100) / 100);
}

export function LaborDotacionMatrixPanel({ companyId }: { companyId: string }) {
  const [tablas, setTablas] = useState<Tabla[]>([]);
  const [tablaId, setTablaId] = useState("");
  const [roles, setRoles] = useState<Rol[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [rolId, setRolId] = useState("");
  const [matriz, setMatriz] = useState<Record<string, Fila>>({});
  const [buscador, setBuscador] = useState("");
  const [filtroEscala, setFiltroEscala] = useState("todas");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNivel, setNuevoNivel] = useState("");
  /* Niveles de la tabla elegida: un cargo nuevo nace con la dotacion de uno. */
  const [niveles, setNiveles] = useState<{ id: string; code: string; name: string; level: number | null }[]>([]);

  const db = () => createBrowserClient(supabaseUrl!, supabasePublishableKey!);

  useEffect(() => {
    if (!tablaId) return;
    setNuevoNivel("");
    void db()
      .from("labor_rate_entries")
      .select("id,code,name,level")
      .eq("labor_rate_table_id", tablaId)
      .order("sort_order")
      .order("name")
      .then(({ data }) => setNiveles(data ?? []));
  }, [tablaId]);

  useEffect(() => {
    if (!companyId || !supabaseUrl || !supabasePublishableKey) return;
    void db()
      .from("labor_rate_tables")
      .select("id,name,version,client_name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("client_name")
      .then(({ data }) => {
        const filas = (data ?? []) as Tabla[];
        setTablas(filas);
        if (filas.length) setTablaId(filas[0].id);
        setCargando(false);
      });
    void db()
      .from("labor_dotacion_concepts")
      .select("id,name,unit,default_unit_value,category,source_name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("category")
      .order("name")
      .then(({ data }) => setConceptos((data ?? []) as Concepto[]));
  }, [companyId]);

  const cargarRoles = useCallback(async () => {
    if (!tablaId) return;
    const { data, error: e } = await db()
      .from("v_labor_role_dotacion")
      .select("role_id,role_code,role_name,scale,labor_rate_entry_id,dotacion_total,dotacion_daily,computed_daily_cost,official_daily_rate,level")
      .eq("labor_rate_table_id", tablaId);
    if (e) { setError(e.message); return; }

    const filas = (data ?? []).map((r) => ({
      id: r.role_id,
      code: r.role_code,
      name: r.role_name,
      scale: r.scale,
      specialty_label: "",
      labor_rate_entry_id: r.labor_rate_entry_id,
      dotacion_total: r.dotacion_total,
      dotacion_daily: r.dotacion_daily,
      computed_daily_cost: r.computed_daily_cost,
      total_daily_rate: r.official_daily_rate,
      level: r.level,
    })) as Rol[];
    setRoles(filas);
    if (filas.length && !filas.some((r) => r.id === rolId)) setRolId(filas[0].id);
  }, [tablaId, rolId]);

  useEffect(() => { void cargarRoles(); }, [cargarRoles]);

  /* Al abrir un cargo se carga su matriz. */
  useEffect(() => {
    if (!rolId) return;
    setAviso("");
    setError("");
    void db()
      .from("labor_role_dotacion")
      .select("concept_id,quantity,replacement_days,unit_value_override,inherited_from_level,notes")
      .eq("labor_rate_role_id", rolId)
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); return; }
        const mapa: Record<string, Fila> = {};
        (data ?? []).forEach((f) => {
          mapa[f.concept_id] = {
            concept_id: f.concept_id,
            quantity: Number(f.quantity),
            replacement_days: Math.max(0, Number(f.replacement_days ?? 0)),
            unit_value_override: f.unit_value_override == null ? null : Number(f.unit_value_override),
            inherited_from_level: f.inherited_from_level,
            notes: f.notes ?? "",
          };
        });
        setMatriz(mapa);
      });
  }, [rolId]);

  const rol = roles.find((r) => r.id === rolId) ?? null;

  /* Cuantos conceptos lleva este cargo y cuantos tocan su plantilla. */
  const resumen = useMemo(() => {
    const claves = Object.keys(matriz);
    const corregidas = claves.filter((k) => !matriz[k].inherited_from_level).length;
    const total = claves.reduce(
      (suma, k) => {
        const c = conceptos.find((x) => x.id === k);
        if (!c) return suma;
        return suma + matriz[k].quantity * (matriz[k].unit_value_override ?? c.default_unit_value);
      },
      0,
    );
    return { conceptos: claves.length, corregidas, total };
  }, [matriz, conceptos]);

  const rolesFiltrados = useMemo(() => {
    const t = buscador.trim().toLowerCase();
    return roles.filter((r) => {
      if (filtroEscala !== "todas" && r.scale !== filtroEscala) return false;
      if (!t) return true;
      return r.name.toLowerCase().includes(t) || r.code.toLowerCase().includes(t);
    });
  }, [roles, buscador, filtroEscala]);

  async function guardarFila(conceptoId: string) {
    if (!rolId) return;
    setGuardando(conceptoId);
    setError("");
    setAviso("");
    const fila = matriz[conceptoId];
    const { error: e } = await db()
      .from("labor_role_dotacion")
      .upsert(
        {
          company_id: companyId,
          labor_rate_role_id: rolId,
          concept_id: conceptoId,
          quantity: fila.quantity,
          replacement_days: fila.replacement_days,
          unit_value_override: fila.unit_value_override,
          inherited_from_level: false,
          notes: fila.notes,
        },
        { onConflict: "labor_rate_role_id,concept_id" },
      );
    if (e) { setError(e.message); setGuardando(null); return; }

    const { error: e2 } = await db().rpc("recompute_labor_role_cost", { p_role_id: rolId });
    if (e2) { setError(e2.message); setGuardando(null); return; }

    setMatriz((m) => ({ ...m, [conceptoId]: { ...m[conceptoId], inherited_from_level: false } }));
    setAviso("Cambio guardado. El costo del cargo ya quedó actualizado.");
    setGuardando(null);
    void cargarRoles();
  }

  /** Devuelve la fila a lo que trae el nivel y avisa que se corrigió. */
  async function volverAlNivel(conceptoId: string) {
    if (!rolId) return;
    setGuardando(conceptoId);
    setError("");
    // La plantilla del nivel se recupera por el nombre del documento del
    // concepto, que es como se empareja la matriz.
    const concepto = conceptos.find((c) => c.id === conceptoId);
    const { data: item } = await db()
      .from("labor_dotacion_items")
      .select("quantity")
      .eq("labor_rate_table_id", tablaId)
      .eq("profile", rol?.level ?? 0)
      .ilike("concept", concepto?.source_name ?? "")
      .maybeSingle();

    const { error: e } = await db()
      .from("labor_role_dotacion")
      .update({ quantity: Number(item?.quantity ?? 0), replacement_days: 0, inherited_from_level: true, unit_value_override: null, notes: "" })
      .eq("labor_rate_role_id", rolId)
      .eq("concept_id", conceptoId);
    if (e) { setError(e.message); setGuardando(null); return; }

    await db().rpc("recompute_labor_role_cost", { p_role_id: rolId });
    setMatriz((m) => ({
      ...m,
      [conceptoId]: {
        ...m[conceptoId],
        quantity: Number(item?.quantity ?? 0),
        replacement_days: 0,
        unit_value_override: null,
        inherited_from_level: true,
        notes: "",
      },
    }));
    setAviso("Se restauró lo que trae el nivel.");
    setGuardando(null);
    void cargarRoles();
  }

  async function crearCargo() {
    if (!tablaId || !nuevoNombre.trim()) return;
    setGuardando("nuevo");
    setError("");
    const { data, error: e } = await db()
      .from("labor_rate_roles")
      .insert({
        company_id: companyId,
        labor_rate_table_id: tablaId,
        code: nuevoCodigo.trim() || `CARGO-${Date.now().toString().slice(-5)}`,
        name: nuevoNombre.trim(),
        labor_rate_entry_id: nuevoNivel || null,
        specialty: "obra_civil",
        specialty_label: "Por definir",
        scale: "propias",
        summary: "Cargo creado desde la matriz de dotación.",
        is_active: true,
      })
      .select("id")
      .single();
    if (e) { setError(e.message); setGuardando(null); return; }

    /* Nace con la dotacion del nivel elegido, para que la fila exista y se
       pueda ajustar desde esta misma pantalla. */
    if (nuevoNivel && data?.id) {
      const nivel = niveles.find((n) => n.id === nuevoNivel);
      const { data: plantilla } = await db()
        .from("labor_dotacion_items")
        .select("concept,quantity")
        .eq("labor_rate_table_id", tablaId)
        .eq("profile", nivel?.level ?? 0);
      const filas = (plantilla ?? [])
        .map((p) => {
          const concepto = conceptos.find(
            (x) => x.source_name.toLowerCase() === String(p.concept).toLowerCase(),
          );
          if (!concepto) return null;
          return {
            company_id: companyId,
            labor_rate_role_id: data.id as string,
            concept_id: concepto.id,
            quantity: Number(p.quantity),
            replacement_days: 0,
            unit_value_override: null,
            inherited_from_level: true,
            notes: "",
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (filas.length) {
        await db().from("labor_role_dotacion").insert(filas);
        await db().rpc("recompute_labor_role_cost", { p_role_id: data.id });
      }
    }

    // Un cargo nuevo nace con la dotacion de un nivel, para que no quede
    // en cero y se pueda ajustar desde la propia pantalla.
    setAviso("Cargo creado. Ya aparece en la lista; selecciónalo para darle su dotación.");
    setNuevoNombre("");
    setNuevoCodigo("");
    setCreando(false);
    setGuardando(null);
    await cargarRoles();
    if (data?.id) setRolId(data.id);
  }

  if (cargando) return <p className="panel-intro">Cargando la matriz de dotación…</p>;

  return (
    <div className="labor-matrix">
      <div className="labor-matrix-head">
        <div>
          <p>
            La fila de la matriz es el cargo, no el nivel. Un oficial y un ayudante
            pueden compartir nivel y llevar cosa distinta. Cada cambio recalcula el
            costo real de ese cargo.
          </p>
        </div>
      </div>

      {error ? <p className="settings-notice" role="alert">{error}</p> : null}
      {aviso ? <p className="settings-notice" role="status">{aviso}</p> : null}

      <div className="labor-matrix-filters">
        <label>
          Tabla del cliente
          <select value={tablaId} onChange={(e) => setTablaId(e.target.value)}>
            {tablas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.version}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar cargo
          <input
            type="search"
            value={buscador}
            onChange={(e) => setBuscador(e.target.value)}
            placeholder="Ej. pailero"
          />
        </label>
        <label>
          Escala
          <select value={filtroEscala} onChange={(e) => setFiltroEscala(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="propias">Actividades propias</option>
            <option value="no_propias">Actividades no propias</option>
            <option value="general">General</option>
          </select>
        </label>
      </div>

      <div className="labor-matrix-body">
        {/* ── Lista de cargos ── */}
        <aside className="labor-matrix-list">
          <div className="labor-matrix-list-head">
            <strong>{rolesFiltrados.length} cargos</strong>
            <button
              type="button"
              className="labor-matrix-nuevo"
              onClick={() => setCreando((v) => !v)}
            >
              {creando ? "Cancelar" : "Agregar cargo"}
            </button>
          </div>

          {creando ? (
            <div className="labor-matrix-form">
              <input
                placeholder="Nombre del cargo"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
              <input
                placeholder="Código (opcional)"
                value={nuevoCodigo}
                onChange={(e) => setNuevoCodigo(e.target.value)}
              />
              <label className="labor-matrix-nivel">
                Nivel del cargo
                <select value={nuevoNivel} onChange={(e) => setNuevoNivel(e.target.value)}>
                  <option value="">Sin nivel</option>
                  {niveles.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                      {n.level ? ` · Nivel ${n.level}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={guardando === "nuevo" || !nuevoNombre.trim()}
                onClick={() => void crearCargo()}
              >
                {guardando === "nuevo" ? "Creando…" : "Crear cargo"}
              </button>
              <small>
                Nace con la dotación del Nivel 1 como base. Ajusta las cantidades
                en la matriz de la derecha.
              </small>
            </div>
          ) : null}

          <div className="labor-matrix-scroll">
            {rolesFiltrados.length === 0 ? (
              <p className="panel-intro">Ningún cargo coincide con la búsqueda.</p>
            ) : (
              rolesFiltrados.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className={`labor-matrix-rol ${rolId === r.id ? "is-on" : ""}`}
                  onClick={() => setRolId(r.id)}
                >
                  <strong>{r.name}</strong>
                  <span>
                    {r.code} · {escala(r.scale)}
                    {r.level ? ` · Nivel ${r.level}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Matriz del cargo ── */}
        <section className="labor-matrix-detail">
          {!rol ? (
            <p className="panel-intro">Seleccione un cargo para ver su dotación.</p>
          ) : (
            <>
              <header className="labor-matrix-detail-head">
                <div>
                  <h4>{rol.name}</h4>
                  <p>
                    {rol.code} · {escala(rol.scale)}
                    {rol.level ? ` · Nivel ${rol.level}` : ""} · Salario oficial {money(rol.total_daily_rate)} al día
                  </p>
                </div>
                <div className="labor-matrix-totals">
                  <span>
                    <small>Dotación</small>
                    <strong>{money(rol.dotacion_total)}</strong>
                  </span>
                  <span>
                    <small>Costo real diario</small>
                    <strong>{money(rol.computed_daily_cost)}</strong>
                  </span>
                </div>
              </header>

              <p className="labor-matrix-note">
                {resumen.conceptos} conceptos · {resumen.corregidas} corregidos a mano sobre la
                plantilla del nivel. La suma da <strong>{money(resumen.total)}</strong>.
                Los <strong>días de reposición</strong> nacen en cero: todavía no se ha definido y el concepto se cuenta una sola vez. Cuando se definan, la cotización repetirá la entrega tantas veces como dure la obra. Los 240 días del documento no se heredan aquí.
              </p>

              <div className="labor-matrix-table-wrap">
                <table className="labor-matrix-table">
                  <thead>
                    <tr>
                      <th>
                        Concepto
                        <HelpHint title="Qué lleva este cargo" compact>
                          El concepto de dotación de la fila: el elemento que recibe el
                          worker. No es el nivel salarial, es el cargo. Un oficial y un
                          ayudante pueden compartir nivel y llevar cosas distintas.
                        </HelpHint>
                      </th>
                      <th>
                        Cantidad
                        <HelpHint title="Cantidad por entrega" compact>
                          Cuántas unidades entrega la empresa cada vez que repone este
                          concepto: dos pares de guantes, un casco. Es la cantidad de
                          una reposición, no la cantidad total de la obra.
                        </HelpHint>
                      </th>
                      <th>
                        Precio
                        <HelpHint title="Precio unitario" compact>
                          Cuánto cuesta una unidad. Sale del catálogo de conceptos y se
                          puede corregir aquí para este cargo sin tocar el catálogo,
                          cuando la compra real difiere del valor estimado.
                        </HelpHint>
                      </th>
                      <th>
                        Días de reposición
                        <HelpHint title="Cada cuántos días se repone" compact>
                          Cuántos días dura el concepto antes de reponerse: los guantes
                          duran semanas, el casco años. En <strong>cero</strong> todavía
                          no se ha definido y el concepto se compra una sola vez, sin
                          repetir. No es un valor heredado de los 240 días de la tabla.
                        </HelpHint>
                      </th>
                      <th>
                        Total
                        <HelpHint title="Costo de la dotación en un año" compact>
                          Cantidad por precio, repetido tantas veces al año como diga la
                          reposición. Es el promedio que se divide entre los días del
                          año para obtener el costo diario que consume el APU. Con la
                          reposición en cero es una sola entrega.
                        </HelpHint>
                      </th>
                      <th>
                        Origen
                        <HelpHint title="De dónde sale esta fila" compact>
                          <strong>Del nivel</strong> es la plantilla que trae el documento
                          del cliente para ese nivel. <strong>Corregido</strong> es que se
                          ajustó a mano para este cargo y ya no sigue la plantilla. El
                          botón «Volver al nivel» deshace la corrección.
                        </HelpHint>
                      </th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {conceptos.map((c) => {
                      const fila = matriz[c.id];
                      const cantidad = fila?.quantity ?? 0;
                      const precio = fila?.unit_value_override ?? c.default_unit_value;
                      /* Sin reposicion definida el total es una sola dotacion.
                         Con reposicion, se proyecta a un ano para que el diario
                         del cargo sea comparable entre conceptos. */
                      const veces = repeticionesAnuales(fila?.replacement_days ?? 0);
                      const total = cantidad * precio * veces;
                      const editada = fila ? !fila.inherited_from_level : false;
                      return (
                        <tr key={c.id} className={editada ? "is-editada" : ""}>
                          <td>
                            <strong>{c.name}</strong>
                            <small>{c.category || c.source_name}</small>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={cantidad}
                              aria-label={`Cantidad de ${c.name}`}
                              onChange={(e) =>
                                setMatriz((m) => ({
                                  ...m,
                                  [c.id]: {
                                    concept_id: c.id,
                                    quantity: Number(e.target.value) || 0,
                                    replacement_days: m[c.id]?.replacement_days ?? 0,
                                    unit_value_override: m[c.id]?.unit_value_override ?? null,
                                    inherited_from_level: false,
                                    notes: m[c.id]?.notes ?? "",
                                  },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="100"
                              value={precio}
                              aria-label={`Precio de ${c.name}`}
                              onChange={(e) =>
                                setMatriz((m) => ({
                                  ...m,
                                  [c.id]: {
                                    concept_id: c.id,
                                    quantity: m[c.id]?.quantity ?? 0,
                                    replacement_days: m[c.id]?.replacement_days ?? 0,
                                    unit_value_override: Number(e.target.value) || 0,
                                    inherited_from_level: false,
                                    notes: m[c.id]?.notes ?? "",
                                  },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <label className="sr-only" htmlFor={`reposicion-${c.id}`}>Días físicos para reponer {c.name}</label>
                            <input
                              id={`reposicion-${c.id}`}
                              type="number"
                              min={0}
                              step={1}
                              value={fila?.replacement_days ?? 0}
                              aria-label={`Reponer ${c.name} cada cuántos días físicos`}
                              onChange={(e) =>
                                setMatriz((m) => ({
                                  ...m,
                                  [c.id]: {
                                    concept_id: c.id,
                                    quantity: m[c.id]?.quantity ?? 0,
                                    replacement_days: Math.max(0, Number(e.target.value) || 0),
                                    unit_value_override: m[c.id]?.unit_value_override ?? null,
                                    inherited_from_level: false,
                                    notes: m[c.id]?.notes ?? "",
                                  },
                                }))
                              }
                            />
                            <small>
                              {fila && fila.replacement_days > 0
                                ? `${repeticionesAnuales(fila.replacement_days)} al año`
                                : "sin definir"}
                            </small>
                          </td>
                          <td>
                            {money(total)}
                            <small>
                              {veces > 1
                                ? `${veces} entregas al año`
                                : "una sola entrega"}
                            </small>
                          </td>
                          <td>
                            {editada ? (
                              <span className="labor-matrix-badge is-editada">corregido</span>
                            ) : (
                              <span className="labor-matrix-badge">del nivel</span>
                            )}
                          </td>
                          <td>
                            <div className="labor-matrix-actions">
                              <button
                                type="button"
                                disabled={guardando === c.id}
                                onClick={() => void guardarFila(c.id)}
                              >
                                {guardando === c.id ? "…" : "Guardar"}
                              </button>
                              {editada ? (
                                <button
                                  type="button"
                                  className="labor-matrix-revertir"
                                  disabled={guardando === c.id}
                                  onClick={() => void volverAlNivel(c.id)}
                                >
                                  Volver al nivel
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}