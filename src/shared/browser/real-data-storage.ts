const CLEANUP_MARKER = "rfc_real_data_cleanup_20261005_v4";

const LEGACY_DEMO_KEYS = [
  "rfc_quotes",
  "rfc_apus",
  "rfc_apu_boq_items",
  "rfc_inventory_movements",
  "rfc_inventory_projects",
  "rfc_inventory_requisitions",
  "rfc_inventory_tool_loans",
  "rfc_quick_rentals",
];

/** Retira los datos de demostración guardados por versiones anteriores y asegura estado en ceros. */
export function prepareRealDataStorage() {
  if (typeof window === "undefined" || localStorage.getItem(CLEANUP_MARKER) === "done") return;
  LEGACY_DEMO_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(CLEANUP_MARKER, "done");
}

