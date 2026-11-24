import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InventoryItem, Site } from '../models/inventory.models';
import { AuthService } from './auth.service';
import { InventoryFilterStore } from './inventory-filter.store';
import { InventoryInsightsService } from './inventory-insights.service';
import { InventoryService } from './inventory.service';
import { ALL_SITES, SiteContextService } from './site-context.service';

const SITES: Site[] = [
  { id: 'rtm', name: 'Rotterdam DC', city: 'Rotterdam', x: 0, y: 0 },
  { id: 'nbo', name: 'Nairobi Hub', city: 'Nairobi', x: 0, y: 0 },
  { id: 'sin', name: 'Singapore DC', city: 'Singapore', x: 0, y: 0 },
];

const item = (overrides: Partial<InventoryItem>): InventoryItem => ({
  id: 1,
  name: 'ESP32-S3 Dev Board',
  description: '',
  sku: 'CMP-ESP32',
  category: 'Compute',
  stock: 90,
  minimumStock: 30,
  unitPrice: 10,
  units: 'pcs',
  status: 'in-stock',
  barcode: 'x',
  imageUrl: null,
  location: 'Rotterdam DC',
  stockBySite: { rtm: 60, nbo: 30, sin: 0 },
  ...overrides,
});

const ITEMS: InventoryItem[] = [
  item({}),
  item({ id: 2, name: 'NVMe SSD', sku: 'STO-NVME', category: 'Storage', stock: 0, status: 'out-of-stock', stockBySite: {} }),
  item({ id: 3, name: 'Router', sku: 'NET-AX', category: 'Networking', stock: 12, minimumStock: 20, status: 'low-stock', stockBySite: { sin: 12 } }),
];

describe('site scoping, RBAC and filtering', () => {
  let auth: AuthService;
  let sites: SiteContextService;
  let insights: InventoryInsightsService;
  let filters: InventoryFilterStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: InventoryService,
          useValue: {
            items: signal(ITEMS),
            sites: signal(SITES),
            activity: signal([]),
            flow: signal([{ label: 'Nov', inbound: 100, sales: 50 }]),
            operations: signal(null),
          },
        },
      ],
    });
    auth = TestBed.inject(AuthService);
    sites = TestBed.inject(SiteContextService);
    insights = TestBed.inject(InventoryInsightsService);
    filters = TestBed.inject(InventoryFilterStore);
  });

  it('computes company-wide metrics for admins on "All sites"', () => {
    expect(sites.isGlobalScope()).toBe(true);
    expect(insights.metrics()).toEqual({
      totalItems: 102,
      skuCount: 3,
      stockValue: 1020,
      lowStockCount: 1,
      outOfStockCount: 1,
    });
  });

  it('re-computes stock and status for a single site', () => {
    sites.select('nbo');
    const esp = insights.items().find((i) => i.id === 1)!;
    expect(esp.stock).toBe(30);
    expect(esp.minimumStock).toBe(10); // 30 apportioned over 3 sites
    expect(esp.status).toBe('in-stock');
    expect(insights.items().find((i) => i.id === 3)!.status).toBe('out-of-stock');
    expect(insights.flow()[0].inbound).toBe(29); // scaled by 30/102 of units
  });

  it('limits operators to their assigned sites', () => {
    auth.switchDemoRole('operator');
    expect(auth.can('settings:manage')).toBe(false);
    expect(auth.can('finance:view')).toBe(false);
    expect(sites.accessibleSites().map((s) => s.id)).toEqual(['rtm', 'nbo']);
    expect(sites.isGlobalScope()).toBe(false);
    expect(insights.metrics().totalItems).toBe(90);

    // A selection outside the user's sites falls back to all accessible sites.
    sites.select('sin');
    expect(sites.selectedSiteId()).toBe(ALL_SITES);
  });

  it('filters by name/SKU, category and status, and resets', () => {
    filters.filters.set({ query: 'nvme', category: 'all', status: 'all' });
    expect(filters.filteredItems().map((i) => i.id)).toEqual([2]);

    filters.filters.set({ query: '', category: 'Networking', status: 'low-stock' });
    expect(filters.filteredItems().map((i) => i.id)).toEqual([3]);
    expect(filters.activeFilterCount()).toBe(2);

    filters.reset();
    expect(filters.filteredCount()).toBe(3);
    expect(filters.hasActiveFilters()).toBe(false);
  });
});
