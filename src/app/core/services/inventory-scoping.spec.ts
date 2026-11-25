import { provideHttpClient } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppUser, Permission, ROLE_PERMISSIONS } from '../models/auth.models';
import { InventoryItem, Site } from '../models/inventory.models';
import { AuthService } from './auth.service';
import { InventoryFilterStore } from './inventory-filter.store';
import { InventoryInsightsService } from './inventory-insights.service';
import { InventoryService } from './inventory.service';
import { ALL_SITES, SiteContextService } from './site-context.service';

const SITES: Site[] = [
  { id: '1', name: 'Rotterdam DC', city: 'Rotterdam', x: 0, y: 0 },
  { id: '4', name: 'Nairobi Hub', city: 'Nairobi', x: 0, y: 0 },
  { id: '3', name: 'Singapore DC', city: 'Singapore', x: 0, y: 0 },
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
  stockBySite: { '1': 60, '4': 30, '3': 0 },
  ...overrides,
});

const ITEMS: InventoryItem[] = [
  item({}),
  item({ id: 2, name: 'NVMe SSD', sku: 'STO-NVME', category: 'Storage', stock: 0, status: 'out-of-stock', stockBySite: {} }),
  item({ id: 3, name: 'Router', sku: 'NET-AX', category: 'Networking', stock: 12, minimumStock: 20, status: 'low-stock', stockBySite: { '3': 12 } }),
];

const ADMIN: AppUser = { id: 2, name: 'Priya', email: 'manager@ims.com', title: 'Admin', role: 'Admin', siteIds: ['*'] };
const OPERATOR: AppUser = { id: 3, name: 'Daniel', email: 'operator@ims.com', title: 'User', role: 'User', siteIds: ['1', '4'] };

describe('site scoping, RBAC and filtering', () => {
  const currentUser = signal<AppUser>(ADMIN);
  let sites: SiteContextService;
  let insights: InventoryInsightsService;
  let filters: InventoryFilterStore;

  beforeEach(() => {
    localStorage.clear();
    currentUser.set(ADMIN);
    const permissions = computed(() => new Set<Permission>(ROLE_PERMISSIONS[currentUser().role]));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        {
          provide: AuthService,
          useValue: {
            user: currentUser,
            isAuthenticated: signal(true),
            can: (p: Permission) => permissions().has(p),
          },
        },
        {
          provide: InventoryService,
          useValue: { items: signal(ITEMS), sites: signal(SITES), version: signal(0) },
        },
      ],
    });
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

  it('re-computes stock and status for a single warehouse', () => {
    sites.select('4');
    const esp = insights.items().find((i) => i.id === 1)!;
    expect(esp.stock).toBe(30);
    expect(esp.status).toBe('low-stock'); // 30 on hand vs. minimum 30
    expect(insights.items().find((i) => i.id === 3)!.status).toBe('out-of-stock');
    expect(insights.metrics().totalItems).toBe(30);
  });

  it('limits Users to their assigned warehouses', () => {
    currentUser.set(OPERATOR);
    expect(sites.hasGlobalAccess()).toBe(false);
    expect(sites.accessibleSites().map((s) => s.id)).toEqual(['1', '4']);
    expect(sites.isGlobalScope()).toBe(false);
    expect(insights.metrics().totalItems).toBe(90);

    // A selection outside the user's warehouses falls back to all accessible ones.
    sites.select('3');
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
