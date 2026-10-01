export type ErpModule = { code: string; name: string; version: string; enabled: boolean; route: string };

export const enabledModules: readonly ErpModule[] = [
  { code: "core", name: "Administración", version: "0.1.0", enabled: true, route: "/dashboard" },
  { code: "quotes", name: "Cotizaciones & Pipeline", version: "0.1.0", enabled: true, route: "/quotes" },
  { code: "inventory", name: "Inventarios", version: "0.1.0", enabled: true, route: "/inventory" },
];
