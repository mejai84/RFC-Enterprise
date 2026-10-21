/**
 * Carga todas las páginas de una consulta de PostgREST.
 *
 * Supabase limita cada respuesta (max_rows = 1000 por defecto). Usar esta
 * función evita que una pantalla muestre solo la primera página y oculte
 * registros que sí existen en la base de datos.
 */
export type LoadAllPage<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export type LoadAllResult<T> = {
  data: T[];
  error: { message: string } | null;
};

export async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<LoadAllPage<T>>,
  pageSize = 1000,
): Promise<LoadAllResult<T>> {
  const rows: T[] = [];
  const safePageSize = Math.max(1, Math.min(pageSize, 1000));
  let from = 0;

  // Un tope defensivo evita un bucle infinito si el servidor devuelve siempre
  // el mismo bloque por una configuración inesperada.
  for (let page = 0; page < 200; page += 1) {
    const { data, error } = await fetchPage(from, from + safePageSize - 1);
    if (error) {
      return { data: rows, error };
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < safePageSize) {
      return { data: rows, error: null };
    }

    from += safePageSize;
  }

  return {
    data: rows,
    error: { message: "La consulta superó el límite de páginas permitido." },
  };
}
