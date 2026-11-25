import { DOCUMENT, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { InventoryFilterStore } from '../../core/services/inventory-filter.store';
import { InventoryInsightsService } from '../../core/services/inventory-insights.service';
import { InventoryService } from '../../core/services/inventory.service';
import { ALL_SITES, SiteContextService } from '../../core/services/site-context.service';
import { IconComponent, IconName } from '../../shared/components/icon.component';
import { CategoryDonutChartComponent } from './components/category-donut-chart.component';
import { InventoryFlowChartComponent } from './components/inventory-flow-chart.component';
import { InventoryTableComponent } from './components/inventory-table.component';
import { KpiCardComponent, KpiVisual } from './components/kpi-card.component';
import { RecentActivityComponent } from './components/recent-activity.component';
import { StockLevelsChartComponent } from './components/stock-levels-chart.component';
import { WarehouseMapComponent } from './components/warehouse-map.component';

interface Kpi {
  id: string;
  label: string;
  value: string;
  caption: string;
  delta: string | null;
  icon: IconName;
  iconClass?: string;
  visual: KpiVisual;
  muted?: boolean;
}

const integer = new Intl.NumberFormat('en-US');
const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Percentage change between the last two points of a trend, e.g. "+4.2%". */
function trendDelta(series: readonly number[]): string | null {
  const [previous, current] = series.slice(-2);
  if (previous === undefined || current === undefined || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    CategoryDonutChartComponent,
    DatePipe,
    IconComponent,
    InventoryFlowChartComponent,
    InventoryTableComponent,
    KpiCardComponent,
    RecentActivityComponent,
    StockLevelsChartComponent,
    WarehouseMapComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-[1600px] flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p class="mt-1 text-sm text-ink-muted">
            Stock, orders and fulfilment for
            <span class="font-semibold text-ink">{{ sites.scopeLabel() }}</span>
          </p>
        </div>

        @if (inventory.source(); as source) {
          <div class="flex flex-wrap items-center gap-2">
            @if (source === 'live') {
              <span class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-good-ink">
                <span class="size-2 rounded-full bg-[#0ca30c]" aria-hidden="true"></span> Live · Supabase
              </span>
              @if (inventory.realtime() === 'live') {
                <span class="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                  <span class="relative flex size-2" aria-hidden="true">
                    <span class="absolute inline-flex size-full animate-ping rounded-full bg-[#0ca30c] opacity-60"></span>
                    <span class="relative inline-flex size-2 rounded-full bg-[#0ca30c]"></span>
                  </span>
                  Realtime
                </span>
              }
              @if (inventory.syncedAt(); as syncedAt) {
                <span class="text-xs text-ink-subtle">
                  Synced <time [attr.datetime]="syncedAt">{{ syncedAt | date: 'shortTime' }}</time>
                </span>
              }
            } @else {
              <span
                class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-warn-ink"
                [title]="inventory.notice() ?? ''"
              >
                <span class="size-2 rounded-full bg-[#fab219]" aria-hidden="true"></span>
                Sample data<span class="sr-only">: {{ inventory.notice() }}</span>
              </span>
            }
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              [disabled]="inventory.isRefreshing()"
              (click)="inventory.reload()"
            >
              <app-icon name="reset" class="size-4" [class.animate-spin]="inventory.isRefreshing()" />
              {{ inventory.isRefreshing() ? 'Refreshing…' : 'Refresh' }}
            </button>
          </div>
        }
      </header>

      @if (inventory.isLoading()) {
        <div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
          <p class="sr-only" role="status">Loading inventory data…</p>
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="h-36 animate-pulse rounded-2xl border border-line bg-surface"></div>
            }
          </div>
          <div class="grid gap-4 xl:grid-cols-3">
            <div class="h-96 animate-pulse rounded-2xl border border-line bg-surface xl:col-span-2"></div>
            <div class="h-96 animate-pulse rounded-2xl border border-line bg-surface"></div>
          </div>
          <div class="h-96 animate-pulse rounded-2xl border border-line bg-surface"></div>
        </div>
      } @else {
        <section aria-label="Key metrics" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (kpi of kpis(); track kpi.id) {
            <app-kpi-card
              [label]="kpi.label"
              [value]="kpi.value"
              [caption]="kpi.caption"
              [delta]="kpi.delta"
              [icon]="kpi.icon"
              [iconClass]="kpi.iconClass ?? 'bg-accent-soft text-accent-ink'"
              [visual]="kpi.visual"
              [muted]="kpi.muted ?? false"
            />
          }
        </section>

        <div class="grid gap-4 xl:grid-cols-3">
          <app-inventory-flow-chart class="xl:col-span-2" [data]="insights.flow()" />
          <app-category-donut-chart [data]="insights.categoryDistribution()" (categorySelected)="focusCategory($event)" />
        </div>

        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <app-warehouse-map
            [sites]="insights.sites()"
            [selectedId]="sites.selectedSite()?.id ?? null"
            (siteSelected)="sites.select($event ?? allSites)"
          />
          <app-stock-levels-chart [data]="insights.stockLevelsByCategory()" (categorySelected)="focusCategory($event)" />
          <app-recent-activity class="md:col-span-2 xl:col-span-1" [events]="insights.activity()" />
        </div>

        <app-inventory-table />
      }
    </div>
  `,
})
export class DashboardComponent {
  protected readonly inventory = inject(InventoryService);
  protected readonly insights = inject(InventoryInsightsService);
  protected readonly sites = inject(SiteContextService);
  private readonly auth = inject(AuthService);
  private readonly filters = inject(InventoryFilterStore);
  private readonly document = inject(DOCUMENT);

  protected readonly allSites = ALL_SITES;

  protected readonly kpis = computed<Kpi[]>(() => {
    const metrics = this.insights.metrics();
    const ops = this.insights.operations();
    const trends = ops?.trends ?? { items: [], value: [], shipments: [] };

    const stockValue: Kpi = this.auth.can('finance:view')
      ? {
          id: 'value',
          label: 'Stock Value',
          value: compactCurrency.format(metrics.stockValue),
          caption: 'at unit cost',
          delta: trendDelta(trends.value),
          icon: 'dollar',
          visual: { kind: 'sparkline', data: trends.value, color: 'var(--color-series-1)' },
        }
      : {
          id: 'value',
          label: 'Stock Value',
          value: 'Restricted',
          caption: 'Requires finance access',
          delta: null,
          icon: 'lock',
          iconClass: 'bg-surface-subtle text-ink-subtle',
          visual: { kind: 'none' },
          muted: true,
        };

    return [
      {
        id: 'items',
        label: 'Total Items',
        value: integer.format(metrics.totalItems),
        caption: `${metrics.lowStockCount} low · ${metrics.outOfStockCount} out of stock`,
        delta: trendDelta(trends.items),
        icon: 'cube',
        visual: { kind: 'sparkline', data: trends.items, color: 'var(--color-series-1)' },
      },
      stockValue,
      {
        id: 'orders',
        label: 'Pending Orders',
        value: integer.format(ops?.pendingOrders ?? 0),
        caption: 'awaiting fulfilment',
        delta: null,
        icon: 'orders',
        iconClass: 'bg-amber-50 text-warn-ink dark:bg-amber-500/15',
        visual: {
          kind: 'progress',
          value: ops?.pendingOrders ?? 0,
          max: ops?.pendingOrdersCapacity ?? 0,
          label: 'Pending orders against daily fulfilment capacity',
        },
      },
      {
        id: 'shipments',
        label: 'Shipments Today',
        value: integer.format(ops?.shipmentsToday ?? 0),
        caption: 'vs. yesterday',
        delta: trendDelta(trends.shipments),
        icon: 'truck',
        iconClass: 'bg-green-50 text-good-ink dark:bg-green-500/15',
        visual: { kind: 'sparkline', data: trends.shipments, color: '#0ca30c' },
      },
    ];
  });

  /** Chart drill-down: filter the table to a category and bring it into view. */
  protected focusCategory(category: string): void {
    this.filters.setCategory(category);
    this.document.getElementById('inventory-items')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
