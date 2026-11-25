import { Component, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { InventoryFilterStore } from '../../core/services/inventory-filter.store';
import { IconComponent } from '../../shared/components/icon.component';
import { AccountMenuComponent } from './account-menu.component';
import { SiteSwitcherComponent } from './site-switcher.component';
import { ThemeToggleComponent } from './theme-toggle.component';

@Component({
  selector: 'app-topbar',
  imports: [AccountMenuComponent, FormField, IconComponent, RouterLink, SiteSwitcherComponent, ThemeToggleComponent],
  template: `
    <header class="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-backdrop-filter:bg-surface/75">
      <div class="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <button
          type="button"
          class="grid size-10 shrink-0 place-items-center rounded-sm text-ink-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-blue-600 lg:hidden"
          aria-haspopup="dialog"
          (click)="menuToggled.emit()"
        >
          <app-icon name="menu" class="size-5" />
          <span class="sr-only">Open navigation</span>
        </button>

        <nav aria-label="Breadcrumb" class="hidden min-w-0 md:block">
          <ol class="flex items-center gap-1.5 text-sm">
            <li><a routerLink="/dashboard" class="text-ink-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600">Home</a></li>
            <li class="flex items-center gap-1.5">
              <app-icon name="chevron-right" class="size-4 text-ink-faint" />
              <span class="truncate font-semibold text-ink" aria-current="page">{{ breadcrumb() }}</span>
            </li>
          </ol>
        </nav>

        <form role="search" class="ml-auto w-full max-w-sm min-w-0" (submit)="onSearch($event)">
          <label for="global-search" class="sr-only">Search products by name or SKU</label>
          <div class="relative">
            <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="global-search"
              type="search"
              autocomplete="off"
              placeholder="Search products or SKU…"
              class="h-10 w-full rounded-sm border border-line bg-surface-muted pr-3 pl-9 text-sm text-ink placeholder:text-ink-subtle focus:border-blue-500 focus:bg-surface focus:ring-4 focus:ring-blue-500/15 focus:outline-none"
              [formField]="searchForm.query"
            />
          </div>
        </form>

        <app-site-switcher class="hidden w-48 shrink-0 lg:block" />
        <app-theme-toggle class="shrink-0" />

        <button
          type="button"
          class="relative hidden size-10 shrink-0 place-items-center rounded-sm text-ink-muted hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-blue-600 sm:grid"
        >
          <app-icon name="bell" class="size-5" />
          <span class="absolute top-2 right-2 size-2 rounded-full bg-red-500 ring-2 ring-surface" aria-hidden="true"></span>
          <span class="sr-only">Notifications, 3 unread</span>
        </button>

        <app-account-menu class="shrink-0" />
      </div>

      <!-- Site switcher moves below the bar on small screens -->
      <div class="border-t border-line px-4 py-2 sm:px-6 lg:hidden">
        <app-site-switcher />
      </div>
    </header>
  `,
  host: { class: 'contents' },
})
export class TopbarComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly filterStore = inject(InventoryFilterStore);

  readonly menuToggled = output();

  /** The global search writes straight into the shared inventory filter model. */
  protected readonly searchForm = form(this.filterStore.filters);

  protected readonly breadcrumb = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.route.snapshot;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return (route.data['breadcrumb'] as string | undefined) ?? 'Dashboard';
      }),
    ),
    { initialValue: 'Dashboard' },
  );

  protected onSearch(event: Event): void {
    event.preventDefault();
    void this.router.navigate(['/dashboard'], { fragment: 'inventory-items' });
  }
}
