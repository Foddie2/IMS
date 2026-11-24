/**
 * Domain models consumed by the UI. Produced either from live InvenTree data
 * (see `inventory.mapper.ts`) or from the bundled sample dataset.
 */

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export const STOCK_STATUSES: readonly StockStatus[] = ['in-stock', 'low-stock', 'out-of-stock'];

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  'in-stock': 'In Stock',
  'low-stock': 'Low Stock',
  'out-of-stock': 'Out of Stock',
};

export interface InventoryItem {
  id: number;
  name: string;
  description: string;
  sku: string;
  category: string;
  stock: number;
  minimumStock: number;
  /** Unit cost in the dashboard currency. */
  unitPrice: number;
  units: string;
  status: StockStatus;
  barcode: string;
  /** Absolute or root-relative image URL; `null` falls back to a placeholder. */
  imageUrl: string | null;
  /** Primary (largest) site holding this item. */
  location: string;
  /** Units on hand per site id. May sum to less than `stock` for unlocated stock. */
  stockBySite: Record<string, number>;
}

/** A physical site (warehouse, store or distribution centre). */
export interface Site {
  id: string;
  name: string;
  city: string;
  /** Pin position on the map, as a percentage of width/height. */
  x: number;
  y: number;
}

/** A site with the units currently held there (for the selected scope). */
export interface SiteWithStock extends Site {
  units: number;
}

export type ActivityType = 'received' | 'shipped' | 'adjusted' | 'alert' | 'order';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Site the event happened at, when known. */
  siteId?: string;
}

export interface FlowPoint {
  label: string;
  inbound: number;
  sales: number;
}

export interface OperationsSnapshot {
  pendingOrders: number;
  pendingOrdersCapacity: number;
  shipmentsToday: number;
  /** Short historical series for the KPI sparklines (oldest → newest). */
  trends: {
    items: readonly number[];
    value: readonly number[];
    shipments: readonly number[];
  };
}

export type DataSource = 'live' | 'sample';

export interface InventorySnapshot {
  source: DataSource;
  /** Human-readable reason when running on sample data. */
  notice: string | null;
  /** ISO time of the last successful InvenTree sync (`null` for sample data). */
  syncedAt: string | null;
  items: InventoryItem[];
  categories: string[];
  sites: Site[];
  activity: ActivityEvent[];
  flow: FlowPoint[];
  operations: OperationsSnapshot;
}

export interface InventoryMetrics {
  totalItems: number;
  skuCount: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface CategoryShare {
  name: string;
  units: number;
  /** 0–1 share of all units. */
  share: number;
  color: string;
}

export interface CategoryStockLevels {
  category: string;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  total: number;
}
