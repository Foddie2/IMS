import {
  ActivityEvent,
  InventoryItem,
  InventorySnapshot,
  Site,
  StockStatus,
} from '../models/inventory.models';
import {
  ActivityEventRow,
  CategoryRow,
  ProductRow,
  SiteRow,
  StockLevelRow,
} from '../models/supabase.models';

export function deriveStockStatus(stock: number, minimumStock: number): StockStatus {
  if (stock <= 0) {
    return 'out-of-stock';
  }
  if (minimumStock > 0 && stock <= minimumStock) {
    return 'low-stock';
  }
  return 'in-stock';
}

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface SupabaseRows {
  sites: readonly SiteRow[];
  categories: readonly CategoryRow[];
  products: readonly ProductRow[];
  stock: readonly StockLevelRow[];
  activity: readonly ActivityEventRow[];
}

export type MappedInventory = Pick<InventorySnapshot, 'items' | 'categories' | 'sites' | 'activity'>;

/**
 * Converts Supabase rows into dashboard domain models. Pure.
 * Rows are already filtered by row-level security, so an operator's items only
 * count stock at the sites they may see.
 */
export function mapSupabaseData({ sites, categories, products, stock, activity }: SupabaseRows): MappedInventory {
  const mappedSites: Site[] = sites.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    x: toNumber(s.map_x, 50),
    y: toNumber(s.map_y, 50),
  }));
  const siteNames = new Map(mappedSites.map((s) => [s.id, s.name]));

  const stockByProduct = new Map<number, Record<string, number>>();
  for (const row of stock) {
    const bySite = stockByProduct.get(row.product_id) ?? {};
    bySite[row.site_id] = (bySite[row.site_id] ?? 0) + row.quantity;
    stockByProduct.set(row.product_id, bySite);
  }

  const items: InventoryItem[] = products.map((p) => {
    const stockBySite = stockByProduct.get(p.id) ?? {};
    const total = Object.values(stockBySite).reduce((sum, q) => sum + q, 0);
    const primarySite = Object.entries(stockBySite).sort(([, a], [, b]) => b - a)[0]?.[0];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      sku: p.sku,
      category: p.category?.name ?? 'Uncategorized',
      stock: total,
      minimumStock: p.minimum_stock,
      unitPrice: toNumber(p.unit_price),
      units: p.units || 'pcs',
      status: deriveStockStatus(total, p.minimum_stock),
      barcode: p.barcode || p.sku,
      imageUrl: p.image_url,
      location: (primarySite && siteNames.get(primarySite)) || 'Unassigned',
      stockBySite,
    };
  });

  const usedCategories = new Set(items.map((i) => i.category));
  const categoryNames = [...new Set([...categories.map((c) => c.name), ...usedCategories])].sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    items,
    categories: categoryNames,
    sites: mappedSites,
    activity: activity.map(
      (e): ActivityEvent => ({
        id: e.id,
        type: e.type,
        title: e.title,
        detail: e.detail,
        timestamp: e.created_at,
        siteId: e.site_id ?? undefined,
      }),
    ),
  };
}
