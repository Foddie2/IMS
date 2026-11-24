/**
 * Raw DTOs returned by the InvenTree REST API.
 *
 * These mirror the server payloads (snake_case, decimal values as strings)
 * and are only consumed by the mapping layer – UI code works with the
 * domain models in `inventory.models.ts`.
 *
 * @see https://docs.inventree.org/en/stable/api/schema/
 */

/** Envelope used by list endpoints when `limit`/`offset` are supplied. */
export interface InvenTreePaginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** List endpoints return a bare array without `limit`, or a page with it. */
export type InvenTreeListResponse<T> = T[] | InvenTreePaginated<T>;

/** `GET /api/part/category/` */
export interface InvenTreeCategory {
  pk: number;
  name: string;
  description: string;
  pathstring: string;
  parent: number | null;
  level: number;
  part_count: number;
  structural: boolean;
  icon?: string | null;
}

/** `GET /api/part/` */
export interface InvenTreePart {
  pk: number;
  name: string;
  full_name?: string;
  description: string;
  /** Internal Part Number – used as the SKU when present. */
  IPN: string | null;
  revision?: string | null;
  keywords?: string | null;
  category: number | null;
  category_name?: string | null;
  category_detail?: InvenTreeCategory | null;
  active: boolean;
  assembly: boolean;
  component: boolean;
  purchaseable: boolean;
  salable: boolean;
  trackable: boolean;
  virtual: boolean;
  units: string | null;
  minimum_stock: number;
  /** Aggregate quantity across all stock items (InvenTree ≥ 0.13). */
  total_in_stock?: number;
  /** Legacy aggregate quantity field. */
  in_stock?: number;
  unallocated_stock?: number;
  /** Relative media URL, e.g. `/media/part_images/foo.png`. */
  image: string | null;
  thumbnail: string | null;
  barcode_hash?: string;
  /** Decimal strings, populated when pricing is enabled on the server. */
  pricing_min?: string | null;
  pricing_max?: string | null;
  link?: string | null;
}

/** Nested location object returned with `?location_detail=true`. */
export interface InvenTreeStockLocation {
  pk: number;
  name: string;
  pathstring: string;
  description?: string;
}

/** `GET /api/stock/` */
export interface InvenTreeStock {
  pk: number;
  part: number;
  quantity: number;
  serial: string | null;
  batch: string | null;
  location: number | null;
  location_detail?: InvenTreeStockLocation | null;
  status: number;
  status_text?: string;
  purchase_price: string | null;
  purchase_price_currency?: string | null;
  updated: string | null;
  stocktake_date?: string | null;
}

/** `GET /api/user/me/` */
export interface InvenTreeUser {
  pk: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

/** Permission verbs InvenTree reports per ruleset. */
export type InvenTreeRuleVerb = 'view' | 'add' | 'change' | 'delete';

/** `GET /api/user/roles/` – rulesets such as `part`, `stock`, `sales_order`, `purchase_order`. */
export interface InvenTreeRoles {
  user: number;
  username: string;
  is_staff: boolean;
  is_superuser: boolean;
  roles: Record<string, InvenTreeRuleVerb[] | null>;
}
