/* ─────────────────────────────────────────────────────────────
 * Módulo APU – Utilidades de Búsqueda y Normalización de Texto
 * Resuelve coincidencias insensibles a tildes, mayúsculas, diacríticos
 * y espaciado múltiple en catálogos de actividades, mano de obra y recursos.
 * ───────────────────────────────────────────────────────────── */

/**
 * Normaliza una cadena eliminando diacríticos (tildes, diéresis),
 * pasando a minúsculas y limpiando espacios superfluos.
 */
export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Divide la consulta del usuario en palabras clave normalizadas.
 */
export function getSearchTokens(query: string): string[] {
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Calcula un puntaje de relevancia (score) para ordenar resultados.
 * - Score > 0 indica coincidencia válida.
 * - Coincidencias en el nombre principal tienen prioridad estricta sobre categorías/grupos.
 */
export function scoreSearch(
  primaryText: string,
  secondaryText?: string,
  query?: string,
): number {
  if (!query || !query.trim()) return 1;

  const tokens = getSearchTokens(query);
  if (!tokens.length) return 1;

  const normPrimary = normalizeSearchText(primaryText);
  const normSecondary = secondaryText ? normalizeSearchText(secondaryText) : "";
  const fullText = `${normPrimary} ${normSecondary}`;

  // Todas las palabras clave deben estar presentes en algún lugar del texto
  const allMatch = tokens.every((token) => fullText.includes(token));
  if (!allMatch) return 0;

  let score = 100;

  // Bonificación por coincidencia exacta o prefijo en el nombre principal
  const normQuery = normalizeSearchText(query);
  if (normPrimary === normQuery) {
    score += 1000;
  } else if (normPrimary.startsWith(normQuery)) {
    score += 600;
  } else if (normPrimary.includes(normQuery)) {
    score += 400;
  }

  // Bonificación si cada palabra individual está en el nombre principal (vs solo en la categoría)
  let tokensInPrimary = 0;
  for (const token of tokens) {
    if (normPrimary.includes(token)) tokensInPrimary++;
  }

  if (tokensInPrimary === tokens.length) {
    score += 300 + tokensInPrimary * 50;
  } else if (tokensInPrimary > 0) {
    score += 150 + tokensInPrimary * 30;
  } else {
    // Si solo coincidió por grupo/categoría, puntaje bajo para que no desplace coincidencias directas
    score += 20;
  }

  return score;
}

/**
 * Filtra y ordena una lista de elementos por relevancia de búsqueda.
 */
export function rankItems<T>(
  items: ReadonlyArray<T>,
  query: string,
  getPrimary: (item: T) => string,
  getSecondary?: (item: T) => string | undefined,
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return [...items];

  const scored: { item: T; score: number }[] = [];

  for (const item of items) {
    const primary = getPrimary(item);
    const secondary = getSecondary ? getSecondary(item) : undefined;
    const score = scoreSearch(primary, secondary, trimmed);
    if (score > 0) {
      scored.push({ item, score });
    }
  }

  // Ordenar de mayor a menor relevancia
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.item);
}
