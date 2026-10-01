"use client";

import { useMemo, useState } from "react";
import { apuActivities, type ApuActivity } from "@/modules/apu";

export function ApuActivityCatalog({ onCreate }: { onCreate: (activity: ApuActivity) => void }) {
  const [search, setSearch] = useState("");
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? apuActivities.filter((activity) => `${activity.name} ${activity.group}`.toLowerCase().includes(term)) : apuActivities;
  }, [search]);
  const custom = search.trim();

  return <section className="apu-activity-catalog" aria-label="Catálogo de actividades APU">
    <div><strong>Catálogo de actividades</strong><small>{apuActivities.length} actividades base. Busca una o agrega una nueva.</small></div>
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar actividad: cubierta, excavación, punto eléctrico…" aria-label="Buscar o agregar actividad APU" />
    <div className="apu-activity-results">{matches.slice(0, 8).map((activity) => <button type="button" key={activity.name} onClick={() => onCreate(activity)}><span>{activity.name}</span><small>{activity.group} · {activity.unit}</small></button>)}</div>
    {custom && !apuActivities.some((activity) => activity.name.toLowerCase() === custom.toLowerCase()) && <button className="apu-custom-activity" type="button" onClick={() => onCreate({ name: custom, unit: "und", group: "Personalizada" })}>Agregar “{custom}” como actividad nueva</button>}
  </section>;
}
