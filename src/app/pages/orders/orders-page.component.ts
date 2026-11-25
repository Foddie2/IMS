import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, applyEach, form, min, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { PurchaseOrderStatus } from '../../core/models/api.models';
import { ProductService, PurchaseOrderService, ReferenceDataService } from '../../core/services/api.services';
import { AuthService } from '../../core/services/auth.service';
import { InventoryService } from '../../core/services/inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { fieldErrorMessage, showFieldError } from '../../shared/utils/field-status';

interface LineModel {
  productId: string;
  quantity: number;
  unitCost: number;
}

interface OrderModel {
  supplierId: string;
  warehouseId: string;
  status: 'Draft' | 'Submitted';
  items: LineModel[];
}

const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  Draft: 'bg-surface-subtle text-ink-secondary',
  Submitted: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Received: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  Cancelled: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const newLine = (): LineModel => ({ productId: '', quantity: 1, unitCost: 0 });

/** Purchase orders (Admin and SuperAdmin). */
@Component({
  selector: 'app-orders-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormField, IconComponent, ModalComponent, PageHeaderComponent],
  template: `
    <div class="mx-auto max-w-[1600px]">
      <app-page-header heading="Purchase Orders" description="Replenishment orders placed with suppliers.">
        <button type="button" class="btn-primary" (click)="openNew()">
          <app-icon name="orders" class="size-4" /> New purchase order
        </button>
      </app-page-header>

      <section class="rounded-sm border border-line bg-surface shadow-sm" aria-label="Purchase orders">
        @if (orders.error(); as error) {
          <p class="px-5 py-10 text-center text-sm text-bad-ink" role="alert">{{ errorMessage(error) }}</p>
        } @else if (orders.isLoading() && !orders.hasValue()) {
          <p class="px-5 py-10 text-center text-sm text-ink-subtle" role="status">Loading purchase orders…</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="data-table min-w-[820px]">
              <caption class="sr-only">Purchase orders</caption>
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Deliver to</th>
                  <th scope="col">Lines</th>
                  <th scope="col" class="text-right">Total</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                @for (o of (orders.hasValue() ? orders.value() : []); track o.id) {
                  <tr>
                    <td class="font-mono text-xs font-semibold text-ink">{{ o.orderNumber }}</td>
                    <td>{{ o.supplierName }}</td>
                    <td>{{ o.warehouseName }}</td>
                    <td>
                      @for (line of o.items; track line.productId) {
                        <span class="block text-xs"><span class="tabular-nums">{{ line.quantity | number }}</span> × {{ line.name }}</span>
                      }
                    </td>
                    <td class="text-right font-semibold text-ink tabular-nums">{{ o.totalAmount | currency }}</td>
                    <td><span class="rounded-sm px-2 py-0.5 text-xs font-semibold" [class]="statusStyles[o.status]">{{ o.status }}</span></td>
                    <td class="whitespace-nowrap"><time [attr.datetime]="o.createdAt">{{ o.createdAt | date: 'MMM d, y' }}</time></td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="py-10 text-center text-ink-subtle">No purchase orders yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>

    <app-modal heading="New purchase order" size="lg" (closed)="error.set(null)">
      <form id="po-form" class="space-y-4" novalidate (submit)="onSubmit($event)">
        @if (error(); as message) {
          <div class="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-bad-ink dark:border-red-500/30 dark:bg-red-500/10" role="alert">
            <app-icon name="alert" class="mt-0.5 size-4" /><span>{{ message }}</span>
          </div>
        }

        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <label for="po-supplier" class="form-label">Supplier</label>
            <select id="po-supplier" class="form-input" [formField]="orderForm.supplierId">
              <option value="">Select…</option>
              @for (s of (suppliers.hasValue() ? suppliers.value() : []); track s.id) {
                <option [value]="'' + s.id">{{ s.name }} ({{ s.leadTimeDays }}d)</option>
              }
            </select>
            @if (show(orderForm.supplierId())) {
              <p class="form-error">{{ message(orderForm.supplierId()) }}</p>
            }
          </div>
          <div>
            <label for="po-warehouse" class="form-label">Deliver to</label>
            <select id="po-warehouse" class="form-input" [formField]="orderForm.warehouseId">
              <option value="">Select…</option>
              @for (site of inventory.sites(); track site.id) {
                <option [value]="site.id">{{ site.name }}</option>
              }
            </select>
            @if (show(orderForm.warehouseId())) {
              <p class="form-error">{{ message(orderForm.warehouseId()) }}</p>
            }
          </div>
          <div>
            <label for="po-status" class="form-label">Status</label>
            <select id="po-status" class="form-input" [formField]="orderForm.status">
              <option value="Submitted">Submit to supplier</option>
              <option value="Draft">Save as draft</option>
            </select>
          </div>
        </div>

        <fieldset class="space-y-2">
          <legend class="form-label">Lines</legend>
          @for (line of orderForm.items; track $index; let i = $index) {
            <div class="grid grid-cols-[1fr_6rem_7rem_auto] items-start gap-2">
              <div>
                <label [for]="'po-product-' + i" class="sr-only">Product, line {{ i + 1 }}</label>
                <select [id]="'po-product-' + i" class="form-input" [formField]="line.productId">
                  <option value="">Product…</option>
                  @for (p of (products.hasValue() ? products.value() : []); track p.id) {
                    <option [value]="'' + p.id">{{ p.name }} ({{ p.sku }})</option>
                  }
                </select>
              </div>
              <div>
                <label [for]="'po-qty-' + i" class="sr-only">Quantity, line {{ i + 1 }}</label>
                <input [id]="'po-qty-' + i" type="number" step="1" class="form-input" [formField]="line.quantity" />
              </div>
              <div>
                <label [for]="'po-cost-' + i" class="sr-only">Unit cost, line {{ i + 1 }}</label>
                <input [id]="'po-cost-' + i" type="number" step="0.01" class="form-input" [formField]="line.unitCost" />
              </div>
              <button type="button" class="grid size-10 place-items-center rounded-sm text-ink-subtle hover:bg-surface-subtle hover:text-bad-ink disabled:opacity-40"
                      [disabled]="model().items.length === 1" (click)="removeLine(i)">
                <app-icon name="close" class="size-4" /><span class="sr-only">Remove line {{ i + 1 }}</span>
              </button>
              @if (show(line.productId()) || show(line.quantity()) || show(line.unitCost())) {
                <p class="form-error col-span-4 -mt-1">
                  {{ show(line.productId()) ? message(line.productId()) : show(line.quantity()) ? message(line.quantity()) : message(line.unitCost()) }}
                </p>
              }
            </div>
          }
          <div class="flex items-center justify-between pt-1">
            <button type="button" class="text-sm font-semibold text-accent-ink hover:underline" (click)="addLine()">+ Add line</button>
            <p class="text-sm text-ink-muted">Total <span class="font-semibold text-ink tabular-nums">{{ total() | currency }}</span></p>
          </div>
        </fieldset>
      </form>

      <ng-container modalFooter>
        <button type="button" class="btn-secondary" (click)="modal().close()">Cancel</button>
        <button type="submit" form="po-form" class="btn-primary" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Create order' }}</button>
      </ng-container>
    </app-modal>
  `,
})
export class OrdersPageComponent {
  private readonly orderApi = inject(PurchaseOrderService);
  private readonly reference = inject(ReferenceDataService);
  private readonly productApi = inject(ProductService);
  private readonly toast = inject(ToastService);
  protected readonly inventory = inject(InventoryService);
  private readonly auth = inject(AuthService);
  private readonly signedIn = () => this.auth.isAuthenticated() || undefined;

  protected readonly modal = viewChild.required(ModalComponent);
  protected readonly statusStyles = STATUS_STYLES;
  protected readonly show = showFieldError;
  protected readonly message = fieldErrorMessage;
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  private readonly reloadToken = signal(0);
  protected readonly orders = rxResource({
    params: () => (this.auth.isAuthenticated() ? this.reloadToken() : undefined),
    stream: () => this.orderApi.list(),
  });
  protected readonly suppliers = rxResource({ params: this.signedIn, stream: () => this.reference.suppliers() });
  protected readonly products = rxResource({ params: this.signedIn, stream: () => this.productApi.list() });

  protected readonly model = signal<OrderModel>({ supplierId: '', warehouseId: '', status: 'Submitted', items: [newLine()] });
  protected readonly orderForm = form(this.model, (path) => {
    required(path.supplierId, { message: 'Choose a supplier.' });
    required(path.warehouseId, { message: 'Choose a warehouse.' });
    applyEach(path.items, (line) => {
      required(line.productId, { message: 'Choose a product.' });
      min(line.quantity, 1, { message: 'Quantity must be at least 1.' });
      min(line.unitCost, 0, { message: 'Cost cannot be negative.' });
    });
  });

  protected readonly total = computed(() =>
    this.model().items.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
  );

  protected openNew(): void {
    this.error.set(null);
    this.model.set({ supplierId: '', warehouseId: '', status: 'Submitted', items: [newLine()] });
    this.modal().open();
  }

  protected addLine(): void {
    this.model.update((m) => ({ ...m, items: [...m.items, newLine()] }));
  }

  protected removeLine(index: number): void {
    this.model.update((m) => ({ ...m, items: m.items.filter((_, i) => i !== index) }));
  }

  protected errorMessage(error: unknown): string {
    return apiErrorMessage(error, 'Purchase orders could not be loaded.');
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.orderForm, async () => {
      const m = this.model();
      this.busy.set(true);
      this.error.set(null);
      try {
        const order = await firstValueFrom(
          this.orderApi.create({
            supplierId: Number(m.supplierId),
            warehouseId: Number(m.warehouseId),
            status: m.status,
            items: m.items.map((l) => ({ productId: Number(l.productId), quantity: Math.trunc(Number(l.quantity)), unitCost: Number(l.unitCost) })),
          }),
        );
        this.toast.success(`Created ${order.orderNumber}.`);
        this.modal().close();
        this.reloadToken.update((v) => v + 1);
        this.inventory.reload();
      } catch (error) {
        this.error.set(apiErrorMessage(error, 'The purchase order could not be created.'));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }
}
