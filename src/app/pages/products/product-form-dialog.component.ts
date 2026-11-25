import { Component, inject, input, output, signal, viewChild } from '@angular/core';
import { FormField, form, maxLength, min, pattern, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { CategoryDto, ProductDto, ProductUpsertRequest } from '../../core/models/api.models';
import { ProductService } from '../../core/services/api.services';
import { apiErrorMessage } from '../../core/utils/api-error';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { FieldStatus, fieldErrorMessage, showFieldError } from '../../shared/utils/field-status';

interface ProductModel {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  unitPrice: number;
  units: string;
  minimumStock: number;
  barcode: string;
  imageUrl: string;
}

const EMPTY: ProductModel = {
  sku: '',
  name: '',
  description: '',
  categoryId: '',
  unitPrice: 0,
  units: 'pcs',
  minimumStock: 0,
  barcode: '',
  imageUrl: '',
};

/** Create / edit a product (Admin and SuperAdmin; the API enforces the role). */
@Component({
  selector: 'app-product-form-dialog',
  imports: [FormField, IconComponent, ModalComponent],
  template: `
    <app-modal [heading]="editing() ? 'Edit product' : 'New product'" size="lg" (closed)="error.set(null)">
      <form id="product-form" class="grid gap-4 sm:grid-cols-2" novalidate (submit)="onSubmit($event)">
        @if (error(); as message) {
          <div class="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-bad-ink sm:col-span-2 dark:border-red-500/30 dark:bg-red-500/10" role="alert">
            <app-icon name="alert" class="mt-0.5 size-4" />
            <span>{{ message }}</span>
          </div>
        }

        <div>
          <label for="pf-sku" class="form-label">SKU</label>
          <input id="pf-sku" type="text" class="form-input font-mono uppercase" [formField]="productForm.sku"
                 [attr.aria-invalid]="show(productForm.sku())" />
          @if (show(productForm.sku())) {
            <p class="form-error">{{ message(productForm.sku()) }}</p>
          }
        </div>
        <div>
          <label for="pf-name" class="form-label">Name</label>
          <input id="pf-name" type="text" class="form-input" [formField]="productForm.name"
                 [attr.aria-invalid]="show(productForm.name())" />
          @if (show(productForm.name())) {
            <p class="form-error">{{ message(productForm.name()) }}</p>
          }
        </div>

        <div class="sm:col-span-2">
          <label for="pf-description" class="form-label">Description</label>
          <textarea id="pf-description" rows="2" class="form-input" [formField]="productForm.description"></textarea>
        </div>

        <div>
          <label for="pf-category" class="form-label">Category</label>
          <select id="pf-category" class="form-input" [formField]="productForm.categoryId">
            <option value="">Uncategorized</option>
            @for (c of categories(); track c.id) {
              <option [value]="'' + c.id">{{ c.name }}</option>
            }
          </select>
        </div>
        <div>
          <label for="pf-units" class="form-label">Units</label>
          <input id="pf-units" type="text" class="form-input" placeholder="pcs, m, kg…" [formField]="productForm.units" />
          @if (show(productForm.units())) {
            <p class="form-error">{{ message(productForm.units()) }}</p>
          }
        </div>

        <div>
          <label for="pf-price" class="form-label">Unit cost (USD)</label>
          <input id="pf-price" type="number" step="0.01" class="form-input" [formField]="productForm.unitPrice" />
          @if (show(productForm.unitPrice())) {
            <p class="form-error">{{ message(productForm.unitPrice()) }}</p>
          }
        </div>
        <div>
          <label for="pf-min" class="form-label">Minimum stock (re-order point)</label>
          <input id="pf-min" type="number" step="1" class="form-input" [formField]="productForm.minimumStock" />
          @if (show(productForm.minimumStock())) {
            <p class="form-error">{{ message(productForm.minimumStock()) }}</p>
          }
        </div>

        <div>
          <label for="pf-barcode" class="form-label">Barcode <span class="font-normal text-ink-subtle">(optional)</span></label>
          <input id="pf-barcode" type="text" class="form-input font-mono" [formField]="productForm.barcode" />
        </div>
        <div>
          <label for="pf-image" class="form-label">Image URL <span class="font-normal text-ink-subtle">(optional)</span></label>
          <input id="pf-image" type="text" class="form-input" placeholder="/images/products/…" [formField]="productForm.imageUrl" />
        </div>
      </form>

      <ng-container modalFooter>
        <button type="button" class="btn-secondary" (click)="modal().close()">Cancel</button>
        <button type="submit" form="product-form" class="btn-primary" [disabled]="busy()">
          @if (busy()) {
            <app-icon name="reset" class="size-4 animate-spin" /> Saving…
          } @else {
            {{ editing() ? 'Save changes' : 'Create product' }}
          }
        </button>
      </ng-container>
    </app-modal>
  `,
})
export class ProductFormDialogComponent {
  private readonly products = inject(ProductService);

  readonly categories = input.required<readonly CategoryDto[]>();
  readonly saved = output<ProductDto>();

  protected readonly modal = viewChild.required(ModalComponent);
  protected readonly editing = signal<ProductDto | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly show = showFieldError;
  protected readonly message = fieldErrorMessage;

  private readonly model = signal<ProductModel>({ ...EMPTY });
  protected readonly productForm = form(this.model, (path) => {
    required(path.sku, { message: 'SKU is required.' });
    maxLength(path.sku, 64, { message: 'At most 64 characters.' });
    pattern(path.sku, /^[A-Za-z0-9._-]+$/, { message: 'Letters, digits, ".", "_" and "-" only.' });
    required(path.name, { message: 'Name is required.' });
    maxLength(path.name, 200, { message: 'At most 200 characters.' });
    maxLength(path.description, 2000);
    required(path.units, { message: 'Units are required.' });
    maxLength(path.units, 20);
    min(path.unitPrice, 0, { message: 'Cost cannot be negative.' });
    min(path.minimumStock, 0, { message: 'Cannot be negative.' });
    maxLength(path.barcode, 64);
    maxLength(path.imageUrl, 500);
  });

  open(product: ProductDto | null = null): void {
    this.editing.set(product);
    this.error.set(null);
    this.model.set(
      product
        ? {
            sku: product.sku,
            name: product.name,
            description: product.description,
            categoryId: product.categoryId !== null ? String(product.categoryId) : '',
            unitPrice: product.unitPrice ?? 0,
            units: product.units,
            minimumStock: product.minimumStock,
            barcode: product.barcode ?? '',
            imageUrl: product.imageUrl ?? '',
          }
        : { ...EMPTY },
    );
    this.modal().open();
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.productForm, async () => {
      const m = this.model();
      const request: ProductUpsertRequest = {
        sku: m.sku.trim().toUpperCase(),
        name: m.name.trim(),
        description: m.description.trim() || null,
        categoryId: m.categoryId ? Number(m.categoryId) : null,
        unitPrice: Number(m.unitPrice) || 0,
        units: m.units.trim(),
        minimumStock: Math.trunc(Number(m.minimumStock) || 0),
        barcode: m.barcode.trim() || null,
        imageUrl: m.imageUrl.trim() || null,
      };
      this.busy.set(true);
      this.error.set(null);
      try {
        const existing = this.editing();
        const saved = await firstValueFrom(
          existing ? this.products.update(existing.id, request) : this.products.create(request),
        );
        this.saved.emit(saved);
        this.modal().close();
      } catch (error) {
        this.error.set(apiErrorMessage(error, 'The product could not be saved.'));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }
}
