import { Service, computed, inject } from '@angular/core';
import {
  CategoryShare,
  CategoryStockLevels,
  FlowPoint,
  InventoryItem,
  InventoryMetrics,
  OperationsSnapshot,
  SiteWithStock,
} from '../models/inventory.models';
import { deriveStockStatus } from '../utils/inventory.mapper';
import { InventoryService } from './inventory.service';
import { SiteContextService } from './site-context.service';

/** Categorical palette slots (CSS variables re-stepped per theme), assigned in fixed order. */
const CATEGORY_COLORS = [
  'var(--color-series-1)',
  'var(--color-series-2)',
  'var(--color-series-3)',
  'var(--color-series-4)',
  'var(--color-series-5)',
] as const;
const OTHER_COLOR = 'var(--color-series-other)';
const MAX_DONUT_SLICES = CATEGORY_COLORS.length;

function sumSites(item: InventoryItem, siteIds: readonly string[]): number {
  return siteIds.reduce((sum, id) => sum + (item.stockBySite[id] ?? 0), 0);
}

/**
 * Site-scoped view of the inventory: every number on the dashboard is derived
 * here with `computed()`, so switching site, role or data source updates the
 * whole page consistently.
 */
@Service()
export class InventoryInsightsService {
  private readonly inventory = inject(InventoryService);
  private readonly siteContext = inject(SiteContextService);

  /** Items with stock, minimum and status re-computed for the selected site scope. */
  readonly items = computed<InventoryItem[]>(() => {
    const items = this.inventory.items();
    if (this.siteContext.isGlobalScope()) return items;

    const scope = this.siteContext.scopeSiteIds();
    const siteCount = Math.max(1, this.inventory.sites().length);
    return items.map((item) => {
      const stock = sumSites(item, scope);
      // Re-order points are company-wide in InvenTree; apportion them across sites.
      const minimumStock = Math.ceil((item.minimumStock * scope.length) / siteCount);
      return { ...item, stock, minimumStock, status: deriveStockStatus(stock, minimumStock) };
    });
  });

  readonly metrics = computed<InventoryMetrics>(() => {
    const items = this.items();
    return {
      totalItems: items.reduce((sum, item) => sum + item.stock, 0),
      skuCount: items.length,
      stockValue: items.reduce((sum, item) => sum + item.stock * item.unitPrice, 0),
      lowStockCount: items.filter((item) => item.status === 'low-stock').length,
      outOfStockCount: items.filter((item) => item.status === 'out-of-stock').length,
    };
  });

  /** Share of company-wide units that fall inside the current scope (scales flow/ops series). */
  private readonly scopeShare = computed(() => {
    if (this.siteContext.isGlobalScope()) return 1;
    const total = this.inventory.items().reduce((sum, item) => sum + item.stock, 0);
    return total > 0 ? this.metrics().totalItems / total : 0;
  });

  /** Accessible sites with units on hand; the selected site is flagged for the map. */
  readonly sites = computed<SiteWithStock[]>(() => {
    const items = this.inventory.items();
    return this.siteContext.accessibleSites().map((site) => ({
      ...site,
      units: items.reduce((sum, item) => sum + (item.stockBySite[site.id] ?? 0), 0),
    }));
  });

  readonly activity = computed(() => {
    const events = this.inventory.activity();
    if (this.siteContext.isGlobalScope()) return events.slice(0, 5);
    const scope = new Set(this.siteContext.scopeSiteIds());
    return events.filter((e) => e.siteId !== undefined && scope.has(e.siteId)).slice(0, 5);
  });

  readonly flow = computed<FlowPoint[]>(() => {
    const share = this.scopeShare();
    return this.inventory.flow().map((p) => ({
      label: p.label,
      inbound: Math.round(p.inbound * share),
      sales: Math.round(p.sales * share),
    }));
  });

  readonly operations = computed<OperationsSnapshot | null>(() => {
    const ops = this.inventory.operations();
    if (!ops) return null;
    const share = this.scopeShare();
    const scale = (n: number) => Math.round(n * share);
    return {
      pendingOrders: scale(ops.pendingOrders),
      pendingOrdersCapacity: Math.max(1, scale(ops.pendingOrdersCapacity)),
      shipmentsToday: scale(ops.shipmentsToday),
      trends: {
        items: ops.trends.items.map(scale),
        value: ops.trends.value.map(scale),
        shipments: ops.trends.shipments.map(scale),
      },
    };
  });

  /** Units per category; the long tail folds into "Other" so colours never cycle. */
  readonly categoryDistribution = computed<CategoryShare[]>(() => {
    const totals = new Map<string, number>();
    for (const item of this.items()) {
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.stock);
    }
    const sorted = [...totals.entries()].filter(([, units]) => units > 0).sort(([, a], [, b]) => b - a);
    const grandTotal = sorted.reduce((sum, [, units]) => sum + units, 0) || 1;

    const needsOther = sorted.length > MAX_DONUT_SLICES;
    const head = needsOther ? sorted.slice(0, MAX_DONUT_SLICES - 1) : sorted;
    const tailUnits = needsOther
      ? sorted.slice(MAX_DONUT_SLICES - 1).reduce((sum, [, units]) => sum + units, 0)
      : 0;

    const shares: CategoryShare[] = head.map(([name, units], index) => ({
      name,
      units,
      share: units / grandTotal,
      color: CATEGORY_COLORS[index],
    }));
    if (needsOther) {
      shares.push({ name: 'Other', units: tailUnits, share: tailUnits / grandTotal, color: OTHER_COLOR });
    }
    return shares;
  });

  /** SKU counts per stock status for each category, largest categories first. */
  readonly stockLevelsByCategory = computed<CategoryStockLevels[]>(() => {
    const byCategory = new Map<string, CategoryStockLevels>();
    for (const item of this.items()) {
      const row = byCategory.get(item.category) ?? {
        category: item.category,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        total: 0,
      };
      if (item.status === 'in-stock') row.inStock++;
      else if (item.status === 'low-stock') row.lowStock++;
      else row.outOfStock++;
      row.total++;
      byCategory.set(item.category, row);
    }
    return [...byCategory.values()].sort(
      (a, b) => b.total - a.total || a.category.localeCompare(b.category),
    );
  });
}
