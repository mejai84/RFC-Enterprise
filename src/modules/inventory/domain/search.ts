import type { StockProduct } from "../fixtures";

export function normalizeInventorySearch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/\s+/g, " ")
    .trim();
}

/** Incluye los sinónimos registrados sin sustituir la denominación técnica oficial. */
export function inventorySearchText(product: Pick<StockProduct, "name" | "sku" | "category" | "brand" | "location" | "aliases">): string {
  return [product.name, product.sku, product.category, product.brand, product.location, ...(product.aliases ?? [])]
    .filter(Boolean)
    .join(" ");
}

export function matchesInventorySearch(product: Pick<StockProduct, "name" | "sku" | "category" | "brand" | "location" | "aliases">, query: string): boolean {
  const tokens = normalizeInventorySearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const text = normalizeInventorySearch(inventorySearchText(product));
  return tokens.every((token) => text.includes(token));
}
