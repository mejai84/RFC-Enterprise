export const avatarStyleOptions = [
  { key: "style-01", label: "Hombre blanco" },
  { key: "style-02", label: "Hombre latino" },
  { key: "style-03", label: "Hombre negro" },
  { key: "style-04", label: "Mujer blanca" },
  { key: "style-05", label: "Mujer latina" },
  { key: "style-06", label: "Mujer negra" },
] as const;

export type AvatarStyle = (typeof avatarStyleOptions)[number]["key"];
export const defaultAvatarStyle: AvatarStyle = "style-02";

export function isAvatarStyle(value: string | null | undefined): value is AvatarStyle {
  return avatarStyleOptions.some((option) => option.key === value);
}

export function specialtyAvatarPath(
  style: AvatarStyle | string | null | undefined,
  category: AvatarCategory,
): string {
  const selectedStyle = isAvatarStyle(style) ? style : defaultAvatarStyle;
  const selectedCategory = category === "generic" ? "admin" : category;
  return `/images/avatars/styles/${selectedStyle}/${selectedCategory}.png`;
}
export type AvatarCategory =
  | "welder"
  | "metal"
  | "electric"
  | "instrumentation"
  | "mechanical"
  | "painting"
  | "hse"
  | "machinery"
  | "civil"
  | "services"
  | "maritime"
  | "admin"
  | "generic";

type AvatarDefinition = {
  key: AvatarCategory;
  label: string;
  color: string;
  keywords: string[];
};

const definitions: AvatarDefinition[] = [
  {
    key: "welder",
    label: "Soldadura",
    color: "#b45309",
    keywords: ["soldador", "soldadura", "esmerilador", "argonero", "smaw", "gtaw"],
  },
  {
    key: "metal",
    label: "Metalmecánica",
    color: "#475569",
    keywords: ["pailero", "tubero", "montador", "alineador", "metalmec", "tubería", "tuberia"],
  },
  {
    key: "electric",
    label: "Eléctrico",
    color: "#ca8a04",
    keywords: ["eléctric", "electric", "planta eléctrica", "electricista"],
  },
  {
    key: "instrumentation",
    label: "Instrumentación",
    color: "#0e7490",
    keywords: ["instrument", "instrumentista", "instrumentación", "instrumentacion"],
  },
  {
    key: "mechanical",
    label: "Mecánica",
    color: "#334155",
    keywords: ["mecánic", "mecanic", "mecánico"],
  },
  {
    key: "painting",
    label: "Pintura",
    color: "#7c3aed",
    keywords: ["pintor", "pintura", "sandblaster", "sandblast"],
  },
  {
    key: "hse",
    label: "HSE y Calidad",
    color: "#15803d",
    keywords: ["hse", "ambiental", "calidad", "rescatista", "vigía", "vigia", "fumigador", "descontamin"],
  },
  {
    key: "machinery",
    label: "Maquinaria",
    color: "#a16207",
    keywords: ["grúa", "grua", "sideboom", "retroexcavadora", "manlift", "bobcat", "torque", "hidrostática", "hidrostatica", "aparejador", "rigger", "volqueta", "conductor"],
  },
  {
    key: "civil",
    label: "Obra Civil",
    color: "#92400e",
    keywords: ["andamiero", "capataz", "topógrafo", "topografo", "albañil", "albanil", "obra civil", "maestro de obra", "jardinero", "guadañador", "guadanador"],
  },
  {
    key: "services",
    label: "Servicios",
    color: "#0369a1",
    keywords: ["bodeguero", "almacenista", "obrero", "auxiliar", "vigilante", "señalizador", "senalizador", "tráfico", "trafico", "aseo", "servicios"],
  },
  {
    key: "maritime",
    label: "Marítimo",
    color: "#1d4ed8",
    keywords: ["marinero", "buzo", "puente", "contramaestre", "capitán", "capitan", "marítim", "maritim", "off shore"],
  },
  {
    key: "admin",
    label: "Administración",
    color: "#166534",
    keywords: ["administrador", "gerente", "gerencial", "administrativo", "auditor", "contador", "residente", "ingeniero", "jefe", "supervisor"],
  },
];

export const avatarDefinitions = definitions;

export function avatarCategory(jobTitle: string | null | undefined): AvatarDefinition {
  const normalized = (jobTitle ?? "")
    .toLocaleLowerCase("es-CO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const match = definitions.find((definition) =>
    definition.keywords.some((keyword) =>
      normalized.includes(
        keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      ),
    ),
  );
  return match ?? { key: "generic", label: "Sin cargo", color: "#64748b", keywords: [] };
}

export function avatarInitials(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("es-CO");
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase("es-CO");
}

export function avatarPath(companyId: string, employeeId: string, fileName: string): string {
  const safeName = fileName
    .toLocaleLowerCase("es-CO")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");
  return `${companyId}/${employeeId}/${Date.now()}-${safeName}`;
}
