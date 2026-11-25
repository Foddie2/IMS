import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, computed, inject, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';
import {
  CategoryShare,
  CategoryStockLevels,
  InventoryItem,
  InventoryMetrics,
  ReportSnapshot,
  SiteWithStock,
} from '../models/inventory.models';
import { deriveStockStatus, mapReportSnapshot } from '../utils/inventory.mapper';
import { ReportService } from './api.services';
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
 * Site-scoped view of the inventory. Stock-derived numbers are computed locally with
 * `computed()` (instant when switching site); flow, activity and order KPIs come from the
 * API's report endpoints for exactly the selected warehouse scope.
 */
@Service()
export class InventoryInsightsService {
  private readonly inventory = inject(InventoryService);
  private readonly siteContext = inject(SiteContextService);
  private readonly reports = inject(ReportService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly reportResource = rxResource<ReportSnapshot, { warehouseId: number | null; version: number } | undefined>({
    params: () => {
      const version = this.inventory.version();
      if (!this.isBrowser || version === 0) return undefined;
      const site = this.siteContext.selectedSite();
      return { warehouseId: site ? Number(site.id) : null, version };
    },
    stream: ({ params }) =>
      forkJoin({
        summary: this.reports.inventorySummary(params.warehouseId),
        flow: this.reports.stockFlow(12, params.warehouseId),
      }).pipe(map(({ summary, flow }) => mapReportSnapshot(summary, flow))),
  });

  /** Keeps showing the previous report while a new scope loads (no chart flicker). */
  private readonly report = linkedSignal<ReportSnapshot | undefined, ReportSnapshot | null>({
    source: () => (this.reportResource.hasValue() ? this.reportResource.value() : undefined),
    computation: (next, previous) => next ?? previous?.value ?? null,
  });

  /** Items with stock and status re-computed for the selected site scope. */
  readonly items = computed<InventoryItem[]>(() => {
    const items = this.inventory.items();
    if (this.siteContext.isGlobalScope()) return items;

    const scope = this.siteContext.scopeSiteIds();
    return items.map((item) => {
      const stock = sumSites(item, scope);
      return { ...item, stock, status: deriveStockStatus(stock, item.minimumStock) };
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

  /** Accessible sites with units on hand. */
  readonly sites = computed<SiteWithStock[]>(() => {
    const items = this.inventory.items();
    return this.siteContext.accessibleSites().map((site) => ({
      ...site,
      units: items.reduce((sum, item) => sum + (item.stockBySite[site.id] ?? 0), 0),
    }));
  });

  readonly activity = computed(() => this.report()?.activity ?? []);
  readonly flow = computed(() => this.report()?.flow ?? []);
  readonly operations = computed(() => this.report()?.operations ?? null);

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
