import {
  InvenTreeCategory,
  InvenTreeListResponse,
  InvenTreePart,
  InvenTreeStock,
} from '../models/inventree.models';
import {
  ActivityEvent,
  InventoryItem,
  InventorySnapshot,
  Site,
  StockStatus,
} from '../models/inventory.models';

/** Pin slots used to lay out live sites on the map placeholder. */
const SITE_PIN_SLOTS: readonly { x: number; y: number }[] = [
  { x: 24, y: 34 },
  { x: 50, y: 22 },
  { x: 60, y: 52 },
  { x: 79, y: 48 },
  { x: 36, y: 64 },
  { x: 70, y: 30 },
  { x: 15, y: 55 },
  { x: 88, y: 70 },
];

export function unwrapList<T>(response: InvenTreeListResponse<T>): T[] {
  return Array.isArray(response) ? response : response.results;
}

export function deriveStockStatus(stock: number, minimumStock: number): StockStatus {
  if (stock <= 0) {
    return 'out-of-stock';
  }
  if (minimumStock > 0 && stock <= minimumStock) {
    return 'low-stock';
  }
  return 'in-stock';
}

export function formatSku(part: Pick<InvenTreePart, 'pk' | 'IPN'>): string {
  const ipn = part.IPN?.trim();
  return ipn ? ipn : `PRT-${String(part.pk).padStart(5, '0')}`;
}

/** Stable site id from a site name, e.g. `"Rotterdam DC"` → `"rotterdam-dc"`. */
export function siteIdFromName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'site'
  );
}

/**
 * In InvenTree a "site" is modelled as a top-level stock location
 * (e.g. `Rotterdam DC / Aisle 4 / Bin 12` belongs to site `Rotterdam DC`).
 */
export function siteNameForLocation(pathstring: string): string {
  return pathstring.split('/')[0].trim() || pathstring;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveUnitPrice(part: InvenTreePart, stockItems: readonly InvenTreeStock[]): number {
  const min = toNumber(part.pricing_min);
  const max = toNumber(part.pricing_max);
  if (min !== null && max !== null) {
    return (min + max) / 2;
  }
  if (min !== null || max !== null) {
    return (min ?? max) as number;
  }

  // Fall back to a quantity-weighted average of recorded purchase prices.
  let quantity = 0;
  let total = 0;
  for (const item of stockItems) {
    const price = toNumber(item.purchase_price);
    if (price !== null && item.quantity > 0) {
      quantity += item.quantity;
      total += price * item.quantity;
    }
  }
  return quantity > 0 ? total / quantity : 0;
}

export interface InvenTreeMapInput {
  parts: readonly InvenTreePart[];
  categories: readonly InvenTreeCategory[];
  stock: readonly InvenTreeStock[];
}

export type MappedInventory = Pick<InventorySnapshot, 'items' | 'categories' | 'sites' | 'activity'>;

/** Converts raw InvenTree payloads into dashboard domain models. Pure. */
export function mapInvenTreeData(
  { parts, categories, stock }: InvenTreeMapInput,
  resolveMediaUrl: (path: string | null) => string | null,
): MappedInventory {
  const categoryNames = new Map(categories.map((c) => [c.pk, c.name]));
  const partNames = new Map(parts.map((p) => [p.pk, p.name]));

  const sitesById = new Map<string, { name: string; units: number }>();
  const stockByPart = new Map<number, InvenTreeStock[]>();
  for (const item of stock) {
    const list = stockByPart.get(item.part) ?? [];
    list.push(item);
    stockByPart.set(item.part, list);

    if (item.location_detail) {
      const name = siteNameForLocation(item.location_detail.pathstring || item.location_detail.name);
      const id = siteIdFromName(name);
      const site = sitesById.get(id) ?? { name, units: 0 };
      site.units += item.quantity;
      sitesById.set(id, site);
    }
  }

  const sites: Site[] = [...sitesById.entries()]
    .sort(([, a], [, b]) => b.units - a.units)
    .map(([id, site], index) => ({
      id,
      name: site.name,
      city: site.name,
      ...SITE_PIN_SLOTS[index % SITE_PIN_SLOTS.length],
    }));
  const siteNames = new Map(sites.map((s) => [s.id, s.name]));

  const items: InventoryItem[] = parts.map((part) => {
    const partStock = stockByPart.get(part.pk) ?? [];
    const stockBySite: Record<string, number> = {};
    for (const item of partStock) {
      if (item.location_detail) {
        const id = siteIdFromName(
          siteNameForLocation(item.location_detail.pathstring || item.location_detail.name),
        );
        stockBySite[id] = (stockBySite[id] ?? 0) + item.quantity;
      }
    }
    const quantity =
      part.total_in_stock ?? part.in_stock ?? partStock.reduce((sum, item) => sum + item.quantity, 0);
    const minimumStock = part.minimum_stock ?? 0;
    const primarySite = Object.entries(stockBySite).sort(([, a], [, b]) => b - a)[0]?.[0];

    return {
      id: part.pk,
      name: part.full_name ?? part.name,
      description: part.description ?? '',
      sku: formatSku(part),
      category:
        part.category_detail?.name ??
        part.category_name ??
        (part.category !== null ? categoryNames.get(part.category) : undefined) ??
        'Uncategorized',
      stock: quantity,
      minimumStock,
      unitPrice: resolveUnitPrice(part, partStock),
      units: part.units || 'pcs',
      status: deriveStockStatus(quantity, minimumStock),
      barcode: part.barcode_hash || formatSku(part),
      imageUrl: resolveMediaUrl(part.thumbnail ?? part.image),
      location: (primarySite && siteNames.get(primarySite)) || 'Unassigned',
      stockBySite,
    };
  });

  return {
    items,
    categories: [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b)),
    sites,
    activity: mapActivity(stock, partNames),
  };
}

function mapActivity(
  stock: readonly InvenTreeStock[],
  partNames: ReadonlyMap<number, string>,
): ActivityEvent[] {
  return stock
    .filter((item): item is InvenTreeStock & { updated: string } => !!item.updated)
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 20)
    .map((item) => ({
      id: `stock-${item.pk}`,
      type: item.quantity <= 0 ? 'alert' : 'adjusted',
      title: `Stock updated · ${partNames.get(item.part) ?? `Part #${item.part}`}`,
      detail: `${item.quantity} units${item.location_detail ? ` at ${item.location_detail.pathstring}` : ''}`,
      timestamp: item.updated,
      siteId: item.location_detail
        ? siteIdFromName(siteNameForLocation(item.location_detail.pathstring || item.location_detail.name))
        : undefined,
    }));
}
