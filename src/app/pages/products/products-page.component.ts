import { CurrencyPipe, DecimalPipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { ProductDto } from '../../core/models/api.models';
import { STOCK_STATUSES, STOCK_STATUS_LABELS, StockStatus } from '../../core/models/inventory.models';
import { ProductService, ReferenceDataService } from '../../core/services/api.services';
import { AuthService } from '../../core/services/auth.service';
import { InventoryService } from '../../core/services/inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { toStockStatus } from '../../core/utils/inventory.mapper';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusIndicatorComponent } from '../../shared/components/status-indicator.component';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { ProductFormDialogComponent } from './product-form-dialog.component';

interface ProductFilters {
  search: string;
  categoryId: string;
  status: StockStatus | 'all';
}

@Component({
  selector: 'app-products-page',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormField,
    HasRoleDirective,
    IconComponent,
    ModalComponent,
    NgOptimizedImage,
    PageHeaderComponent,
    ProductFormDialogComponent,
    StatusIndicatorComponent,
  ],
  template: `
    <div class="mx-auto max-w-[1600px]">
      <app-page-header heading="Products" description="The product catalogue with live stock totals for your warehouses.">
        <button type="button" class="btn-primary" *appHasRole="['Admin', 'SuperAdmin']" (click)="formDialog().open()">
          <app-icon name="cube" class="size-4" /> New product
        </button>
      </app-page-header>

      <section class="rounded-sm border border-line bg-surface shadow-sm" aria-label="Products">
        <div class="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-end">
          <div class="flex-1 lg:max-w-xs">
            <label for="pr-search" class="form-label text-xs">Search</label>
            <div class="relative">
              <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
              <input id="pr-search" type="search" class="form-input pl-9" placeholder="Name or SKU" [formField]="filterForm.search" />
            </div>
          </div>
          <div class="lg:w-56">
            <label for="pr-category" class="form-label text-xs">Category</label>
            <select id="pr-category" class="form-input" [formField]="filterForm.categoryId">
              <option value="">All categories</option>
              @for (c of (categories.hasValue() ? categories.value() : []); track c.id) {
                <option [value]="'' + c.id">{{ c.name }}</option>
              }
            </select>
          </div>
          <div class="lg:w-48">
            <label for="pr-status" class="form-label text-xs">Stock status</label>
            <select id="pr-status" class="form-input" [formField]="filterForm.status">
              <option value="all">All statuses</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ statusLabels[s] }}</option>
              }
            </select>
          </div>
          <button type="button" class="btn-secondary lg:ml-auto" [disabled]="!hasFilters()" (click)="resetFilters()">
            <app-icon name="reset" class="size-4" /> Reset filters
          </button>
        </div>

        <p class="border-b border-line px-5 py-2 text-sm text-ink-muted" aria-live="polite">
          Showing <span class="font-semibold text-ink tabular-nums">{{ rows().length }}</span> of {{ ((products.hasValue() ? products.value() : [])).length }} products
        </p>

        @if (products.error(); as error) {
          <p class="px-5 py-10 text-center text-sm text-bad-ink" role="alert">{{ errorMessage(error) }}</p>
        } @else if (products.isLoading() && !products.hasValue()) {
          <p class="px-5 py-10 text-center text-sm text-ink-subtle" role="status">Loading products…</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="data-table min-w-[900px]">
              <caption class="sr-only">Products</caption>
              <thead>
                <tr>
                  <th scope="col"><span class="sr-only">Image</span></th>
                  <th scope="col">Product</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Category</th>
                  @if (canSeeCost()) {
                    <th scope="col" class="text-right">Unit cost</th>
                  }
                  <th scope="col" class="text-right">Min stock</th>
                  <th scope="col" class="text-right">On hand</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="text-right"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of rows(); track p.id) {
                  <tr>
                    <td class="w-14">
                      <img [ngSrc]="p.imageUrl || placeholder" width="36" height="36" alt=""
                           class="size-9 rounded-sm border border-line bg-surface-muted object-contain p-0.5" />
                    </td>
                    <td>
                      <span class="block font-medium text-ink">{{ p.name }}</span>
                      <span class="block max-w-xs truncate text-xs text-ink-subtle">{{ p.description }}</span>
                    </td>
                    <td class="font-mono text-xs">{{ p.sku }}</td>
                    <td class="whitespace-nowrap">{{ p.categoryName ?? 'Uncategorized' }}</td>
                    @if (canSeeCost()) {
                      <td class="text-right tabular-nums">{{ p.unitPrice | currency }}</td>
                    }
                    <td class="text-right tabular-nums">{{ p.minimumStock | number }}</td>
                    <td class="text-right font-semibold text-ink tabular-nums">{{ p.totalQuantity | number }} <span class="text-xs font-normal text-ink-subtle">{{ p.units }}</span></td>
                    <td><app-status-indicator [status]="statusOf(p)" /></td>
                    <td class="text-right whitespace-nowrap">
                      <button *appHasRole="['Admin', 'SuperAdmin']" type="button"
                              class="rounded-sm px-2.5 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-blue-600"
                              (click)="formDialog().open(p)">
                        Edit<span class="sr-only"> {{ p.name }}</span>
                      </button>
                      <button *appHasRole="['SuperAdmin']" type="button"
                              class="rounded-sm px-2.5 py-1.5 text-sm font-medium text-bad-ink hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-red-500/10"
                              (click)="confirmDelete(p)">
                        Delete<span class="sr-only"> {{ p.name }}</span>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="canSeeCost() ? 9 : 8" class="py-12 text-center">
                      <p class="font-semibold text-ink">No products match your filters</p>
                      <button type="button" class="btn-secondary mt-3" (click)="resetFilters()">Reset filters</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>

    <app-product-form-dialog [categories]="(categories.hasValue() ? categories.value() : [])" (saved)="onSaved($event)" />

    <app-modal #deleteDialog heading="Delete product?" [description]="'This removes ' + (pendingDelete()?.name ?? '') + ' from the catalogue. Stock history and audit records are kept.'">
      <p class="text-sm text-ink-muted">
        SKU <span class="font-mono font-semibold text-ink">{{ pendingDelete()?.sku }}</span>
        · {{ pendingDelete()?.totalQuantity ?? 0 | number }} units currently on hand.
      </p>
      <ng-container modalFooter>
        <button type="button" class="btn-secondary" (click)="deleteDialog.close()">Cancel</button>
        <button type="button" class="btn-danger" [disabled]="deleting()" (click)="deleteProduct()">
          {{ deleting() ? 'Deleting…' : 'Delete product' }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class ProductsPageComponent {
  private readonly productApi = inject(ProductService);
  private readonly reference = inject(ReferenceDataService);
  private readonly inventory = inject(InventoryService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly formDialog = viewChild.required(ProductFormDialogComponent);
  private readonly deleteDialog = viewChild.required<ModalComponent>('deleteDialog');

  protected readonly placeholder = '/images/products/placeholder.svg';
  protected readonly statuses = STOCK_STATUSES;
  protected readonly statusLabels = STOCK_STATUS_LABELS;
  protected readonly canSeeCost = computed(() => this.auth.can('finance:view'));

  private readonly reloadToken = signal(0);
  protected readonly products = rxResource({
    params: () => (this.auth.isAuthenticated() ? this.reloadToken() : undefined),
    stream: () => this.productApi.list(),
  });
  protected readonly categories = rxResource({
    params: () => this.auth.isAuthenticated() || undefined,
    stream: () => this.reference.categories(),
  });

  private readonly filters = signal<ProductFilters>({ search: '', categoryId: '', status: 'all' });
  protected readonly filterForm = form(this.filters);
  protected readonly hasFilters = computed(() => {
    const f = this.filters();
    return f.search.trim() !== '' || f.categoryId !== '' || f.status !== 'all';
  });

  /** Instant client-side filtering (name/SKU, category, stock status). */
  protected readonly rows = computed(() => {
    const { search, categoryId, status } = this.filters();
    const needle = search.trim().toLowerCase();
    return ((this.products.hasValue() ? this.products.value() : [])).filter(
      (p) =>
        (!needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)) &&
        (!categoryId || String(p.categoryId) === categoryId) &&
        (status === 'all' || toStockStatus(p.stockStatus) === status),
    );
  });

  protected readonly pendingDelete = signal<ProductDto | null>(null);
  protected readonly deleting = signal(false);

  protected statusOf(p: ProductDto): StockStatus {
    return toStockStatus(p.stockStatus);
  }

  protected resetFilters(): void {
    this.filters.set({ search: '', categoryId: '', status: 'all' });
  }

  protected errorMessage(error: unknown): string {
    return apiErrorMessage(error, 'Products could not be loaded.');
  }

  protected onSaved(product: ProductDto): void {
    this.toast.success(`Saved ${product.name}.`);
    this.refresh();
  }

  protected confirmDelete(product: ProductDto): void {
    this.pendingDelete.set(product);
    this.deleteDialog().open();
  }

  protected async deleteProduct(): Promise<void> {
    const product = this.pendingDelete();
    if (!product) return;
    this.deleting.set(true);
    try {
      await firstValueFrom(this.productApi.delete(product.id));
      this.toast.success(`Deleted ${product.name}.`);
      this.deleteDialog().close();
      this.refresh();
    } catch (error) {
      this.toast.error(apiErrorMessage(error, 'The product could not be deleted.'));
    } finally {
      this.deleting.set(false);
    }
  }

  private refresh(): void {
    this.reloadToken.update((v) => v + 1);
    this.inventory.reload();
  }
}
