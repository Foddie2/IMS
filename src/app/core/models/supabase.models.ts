/**
 * Row shapes returned by the Supabase queries in `InventoryService` / `AuthService`.
 * They mirror `supabase/migrations/0001_inventory_schema.sql`.
 */
import { ActivityType } from './inventory.models';
import { Role } from './auth.models';

export interface SiteRow {
  id: string;
  name: string;
  city: string;
  /** numeric columns arrive as numbers (or strings for very large precision). */
  map_x: number | string;
  map_y: number | string;
}

export interface CategoryRow {
  id: number;
  name: string;
}

export interface ProductRow {
  id: number;
  sku: string;
  name: string;
  description: string;
  unit_price: number | string;
  units: string;
  minimum_stock: number;
  barcode: string | null;
  image_url: string | null;
  /** Embedded via `category:categories(name)`. */
  category: { name: string } | null;
}

export interface StockLevelRow {
  product_id: number;
  site_id: string;
  quantity: number;
  updated_at: string;
}

export interface ActivityEventRow {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  site_id: string | null;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  full_name: string;
  title: string;
  role: Role;
  site_ids: string[];
}
