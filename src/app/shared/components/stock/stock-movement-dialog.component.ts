import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormField, form, max, maxLength, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { StockMovementResultDto, StockMovementType } from '../../../core/models/api.models';
import { InventoryItem, Site } from '../../../core/models/inventory.models';
import { StockMovementService } from '../../../core/services/api.services';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { IconComponent } from '../icon.component';
import { ModalComponent } from '../modal.component';

/** The bits of a Signal Forms field state the template needs. */
interface FieldStatus {
  touched(): boolean;
  invalid(): boolean;
  errors(): readonly { message?: string }[];
}

interface MovementModel {
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  quantity: number;
  destinationWarehouseId: string;
  referenceNumber: string;
  notes: string;
}

const TYPES: readonly { value: StockMovementType; label: string; hint: string }[] = [
  { value: 'Inbound', label: 'Inbound', hint: 'Goods received' },
  { value: 'Outbound', label: 'Outbound', hint: 'Shipped or sold' },
  { value: 'Adjustment', label: 'Adjustment', hint: 'Count correction (±)' },
  { value: 'Transfer', label: 'Transfer', hint: 'Between warehouses' },
];

const EMPTY: MovementModel = {
  productId: '',
  warehouseId: '',
  type: 'Inbound',
  quantity: 1,
  destinationWarehouseId: '',
  referenceNumber: '',
  notes: '',
};

/**
 * Records a stock movement via POST /api/stock-movements. The API runs it in a transaction
 * and is the authority on stock levels; the client-side checks only give early feedback.
 */
@Component({
  selector: 'app-stock-movement-dialog',
  imports: [DecimalPipe, FormField, IconComponent, ModalComponent],
  template: `
    <app-modal heading="Record stock movement" description="Updates warehouse stock and the audit log in one transaction." (closed)="reset()">
      <form id="movement-form" class="space-y-4" novalidate (submit)="onSubmit($event)">
        @if (error(); as message) {
          <div class="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-bad-ink dark:border-red-500/30 dark:bg-red-500/10" role="alert">
            <app-icon name="alert" class="mt-0.5 size-4" />
            <span>{{ message }}</span>
          </div>
        }

        <fieldset>
          <legend class="form-label">Movement type</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (option of types; track option.value) {
              <label
                class="cursor-pointer rounded-sm border border-line px-3 py-2 text-sm has-[:checked]:border-blue-500 has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600"
              >
                <input type="radio" class="sr-only" [value]="option.value" [formField]="movementForm.type" />
                <span class="block font-semibold text-ink">{{ option.label }}</span>
                <span class="block text-xs text-ink-subtle">{{ option.hint }}</span>
              </label>
            }
          </div>
        </fieldset>

        <div>
          <label for="mv-product" class="form-label">Product</label>
          <select id="mv-product" class="form-input" [formField]="movementForm.productId">
            <option value="">Select a product…</option>
            @for (item of items(); track item.id) {
              <option [value]="'' + item.id">{{ item.name }} ({{ item.sku }})</option>
            }
          </select>
          @if (show(movementForm.productId())) {
            <p class="form-error">{{ firstError(movementForm.productId()) }}</p>
          }
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="mv-warehouse" class="form-label">{{ model().type === 'Transfer' ? 'From warehouse' : 'Warehouse' }}</label>
            <select id="mv-warehouse" class="form-input" [formField]="movementForm.warehouseId">
              <option value="">Select…</option>
              @for (site of sites(); track site.id) {
                <option [value]="site.id">{{ site.name }}</option>
              }
            </select>
            @if (available() !== null) {
              <p class="mt-1 text-xs text-ink-subtle">On hand: <span class="font-semibold text-ink">{{ available() | number }}</span></p>
            }
            @if (show(movementForm.warehouseId())) {
              <p class="form-error">{{ firstError(movementForm.warehouseId()) }}</p>
            }
          </div>

          @if (model().type === 'Transfer') {
            <div>
              <label for="mv-destination" class="form-label">To warehouse</label>
              <select id="mv-destination" class="form-input" [formField]="movementForm.destinationWarehouseId">
                <option value="">Select…</option>
                @for (site of sites(); track site.id) {
                  <option [value]="site.id">{{ site.name }}</option>
                }
              </select>
              @if (show(movementForm.destinationWarehouseId())) {
                <p class="form-error">{{ firstError(movementForm.destinationWarehouseId()) }}</p>
              }
            </div>
          }

          <div>
            <label for="mv-quantity" class="form-label">
              {{ model().type === 'Adjustment' ? 'Adjustment (use − to reduce)' : 'Quantity' }}
            </label>
            <input id="mv-quantity" type="number" class="form-input" step="1" [formField]="movementForm.quantity" />
            @if (show(movementForm.quantity())) {
              <p class="form-error">{{ firstError(movementForm.quantity()) }}</p>
            }
          </div>

          <div>
            <label for="mv-reference" class="form-label">Reference <span class="font-normal text-ink-subtle">(optional)</span></label>
            <input id="mv-reference" type="text" class="form-input" placeholder="e.g. GRN-1042, SO-5180" [formField]="movementForm.referenceNumber" />
          </div>
        </div>

        <div>
          <label for="mv-notes" class="form-label">Notes <span class="font-normal text-ink-subtle">(optional)</span></label>
          <textarea id="mv-notes" rows="2" class="form-input" [formField]="movementForm.notes"></textarea>
        </div>
      </form>

      <ng-container modalFooter>
        <button type="button" class="btn-secondary" (click)="modal().close()">Cancel</button>
        <button type="submit" form="movement-form" class="btn-primary" [disabled]="busy()">
          @if (busy()) {
            <app-icon name="reset" class="size-4 animate-spin" /> Saving…
          } @else {
            Record movement
          }
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class StockMovementDialogComponent {
  private readonly movements = inject(StockMovementService);

  readonly items = input.required<readonly InventoryItem[]>();
  readonly sites = input.required<readonly Site[]>();
  readonly recorded = output<StockMovementResultDto>();

  protected readonly modal = viewChild.required(ModalComponent);
  protected readonly types = TYPES;
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly model = signal<MovementModel>({ ...EMPTY });

  /** Units on hand at the selected source warehouse. */
  protected readonly available = computed(() => {
    const { productId, warehouseId } = this.model();
    const item = this.items().find((i) => String(i.id) === productId);
    return item && warehouseId ? (item.stockBySite[warehouseId] ?? 0) : null;
  });

  protected readonly movementForm = form(this.model, (path) => {
    required(path.productId, { message: 'Choose a product.' });
    required(path.warehouseId, { message: 'Choose a warehouse.' });
    required(path.quantity, { message: 'Enter a quantity.' });
    maxLength(path.referenceNumber, 64);
    maxLength(path.notes, 1000);
    max(path.quantity, 1_000_000);
    validate(path.quantity, ({ value, valueOf }) => {
      const quantity = value();
      const type = valueOf(path.type);
      if (!Number.isInteger(quantity) || quantity === 0) {
        return { kind: 'quantity', message: 'Enter a whole number other than 0.' };
      }
      if (type !== 'Adjustment' && quantity < 0) {
        return { kind: 'quantity', message: 'Quantity must be positive.' };
      }
      const available = this.available();
      const removes = type === 'Outbound' || type === 'Transfer' ? quantity : type === 'Adjustment' && quantity < 0 ? -quantity : 0;
      if (available !== null && removes > available) {
        return { kind: 'stock', message: `Only ${available} available in this warehouse.` };
      }
      return undefined;
    });
    validate(path.destinationWarehouseId, ({ value, valueOf }) => {
      if (valueOf(path.type) !== 'Transfer') return undefined;
      if (!value()) return { kind: 'required', message: 'Choose the destination warehouse.' };
      if (value() === valueOf(path.warehouseId)) return { kind: 'same', message: 'Choose a different warehouse.' };
      return undefined;
    });
  });

  /** Opens the dialog, optionally preselecting a product and/or warehouse. */
  open(preset: { productId?: number; warehouseId?: string; type?: StockMovementType } = {}): void {
    this.reset();
    const onlySite = this.sites().length === 1 ? this.sites()[0].id : '';
    this.model.set({
      ...EMPTY,
      productId: preset.productId ? String(preset.productId) : '',
      warehouseId: preset.warehouseId ?? onlySite,
      type: preset.type ?? 'Inbound',
    });
    this.modal().open();
  }

  protected reset(): void {
    this.error.set(null);
    this.busy.set(false);
  }

  protected show(state: FieldStatus): boolean {
    return state.touched() && state.invalid();
  }

  protected firstError(state: FieldStatus): string {
    return state.errors()[0]?.message ?? 'Invalid value.';
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.movementForm, async () => {
      const m = this.model();
      this.error.set(null);
      this.busy.set(true);
      try {
        const result = await firstValueFrom(
          this.movements.create({
            productId: Number(m.productId),
            warehouseId: Number(m.warehouseId),
            type: m.type,
            quantity: m.quantity,
            destinationWarehouseId: m.type === 'Transfer' ? Number(m.destinationWarehouseId) : null,
            referenceNumber: m.referenceNumber.trim() || null,
            notes: m.notes.trim() || null,
          }),
        );
        this.recorded.emit(result);
        this.modal().close();
      } catch (error) {
        this.error.set(apiErrorMessage(error, 'The movement could not be recorded.'));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }
}
