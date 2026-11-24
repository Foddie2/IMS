import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { Site } from '../models/inventory.models';
import { STORAGE_KEYS, readStorage, writeStorage } from '../utils/browser-storage';
import { AuthService } from './auth.service';
import { InventoryService } from './inventory.service';

export const ALL_SITES = 'all';

/**
 * Multi-site context: which sites the current user may access and which one
 * the dashboard is scoped to. Selection survives reloads and role switches
 * (an inaccessible selection silently falls back to "all accessible sites").
 */
@Service()
export class SiteContextService {
  private readonly inventory = inject(InventoryService);
  private readonly auth = inject(AuthService);

  private readonly requested = signal<string>(ALL_SITES);

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this.requested.set(readStorage(STORAGE_KEYS.site) ?? ALL_SITES);
    }
  }

  readonly hasGlobalAccess = computed(
    () => this.auth.can('sites:all') || this.auth.user().siteIds.includes('*'),
  );

  readonly accessibleSites = computed<Site[]>(() => {
    const sites = this.inventory.sites();
    if (this.hasGlobalAccess()) return sites;
    const allowed = new Set(this.auth.user().siteIds);
    return sites.filter((site) => allowed.has(site.id));
  });

  readonly selectedSiteId = computed(() => {
    const requested = this.requested();
    const sites = this.accessibleSites();
    if (requested !== ALL_SITES && sites.some((s) => s.id === requested)) return requested;
    return sites.length === 1 ? sites[0].id : ALL_SITES;
  });

  readonly selectedSite = computed(
    () => this.accessibleSites().find((s) => s.id === this.selectedSiteId()) ?? null,
  );

  /** Site ids the dashboard currently aggregates over. */
  readonly scopeSiteIds = computed<readonly string[]>(() => {
    const selected = this.selectedSite();
    return selected ? [selected.id] : this.accessibleSites().map((s) => s.id);
  });

  /** True when the scope is the whole company (so unlocated stock counts too). */
  readonly isGlobalScope = computed(() => this.selectedSiteId() === ALL_SITES && this.hasGlobalAccess());

  readonly scopeLabel = computed(
    () => this.selectedSite()?.name ?? (this.hasGlobalAccess() ? 'All sites' : 'All my sites'),
  );

  select(siteId: string): void {
    this.requested.set(siteId);
    writeStorage(STORAGE_KEYS.site, siteId);
  }
}
