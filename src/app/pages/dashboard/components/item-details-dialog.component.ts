import { CurrencyPipe, DecimalPipe, NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { InventoryItem } from '../../../core/models/inventory.models';
import { BarcodeComponent } from '../../../shared/components/barcode.component';
import { IconComponent } from '../../../shared/components/icon.component';
import { StatusIndicatorComponent } from '../../../shared/components/status-indicator.component';

export const PLACEHOLDER_IMAGE = '/images/products/placeholder.svg';

/** Product detail view on the native `<dialog>` – focus trapping and Escape come built in. */
@Component({
  selector: 'app-item-details-dialog',
  imports: [BarcodeComponent, CurrencyPipe, DecimalPipe, IconComponent, NgOptimizedImage, StatusIndicatorComponent],
  template: `
    <dialog
      #dialog
      class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-sm border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
      aria-labelledby="item-dialog-title"
      (close)="closed.emit()"
    >
      @if (item(); as item) {
        <div class="flex items-start gap-4 border-b border-line p-5">
          <img
            [ngSrc]="item.imageUrl ?? placeholder"
            width="64"
            height="64"
            alt=""
            class="size-16 shrink-0 rounded-sm border border-line bg-surface-muted object-contain p-1"
          />
          <div class="min-w-0 flex-1">
            <h2 id="item-dialog-title" class="text-lg font-semibold">{{ item.name }}</h2>
            <p class="font-mono text-xs text-ink-subtle">{{ item.sku }}</p>
            <div class="mt-1.5"><app-status-indicator [status]="item.status" /></div>
          </div>
          <button
            type="button"
            class="grid size-9 place-items-center rounded-sm text-ink-subtle hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600"
            (click)="close()"
          >
            <app-icon name="close" class="size-5" />
            <span class="sr-only">Close</span>
          </button>
        </div>

        <div class="space-y-4 p-5 text-sm">
          @if (item.description) {
            <p class="text-ink-muted">{{ item.description }}</p>
          }
          <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
            <div><dt class="text-xs text-ink-subtle">Category</dt><dd class="font-medium">{{ item.category }}</dd></div>
            <div><dt class="text-xs text-ink-subtle">Location</dt><dd class="font-medium">{{ item.location }}</dd></div>
            <div><dt class="text-xs text-ink-subtle">On hand</dt><dd class="font-medium tabular-nums">{{ item.stock | number }} {{ item.units }}</dd></div>
            <div><dt class="text-xs text-ink-subtle">Minimum stock</dt><dd class="font-medium tabular-nums">{{ item.minimumStock | number }} {{ item.units }}</dd></div>
            @if (showFinance()) {
              <div><dt class="text-xs text-ink-subtle">Unit cost</dt><dd class="font-medium tabular-nums">{{ item.unitPrice | currency }}</dd></div>
              <div><dt class="text-xs text-ink-subtle">Stock value</dt><dd class="font-medium tabular-nums">{{ item.stock * item.unitPrice | currency }}</dd></div>
            } @else {
              <div class="col-span-2 flex items-center gap-2 text-xs text-ink-subtle">
                Cost data requires finance access.
              </div>
            }
          </dl>
          <app-barcode [value]="item.barcode" />
        </div>

        <div class="flex justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3">
          <button
            type="button"
            class="rounded-sm bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            (click)="close()"
          >
            Done
          </button>
        </div>
      }
    </dialog>
  `,
})
export class ItemDetailsDialogComponent {
  readonly item = input<InventoryItem | null>(null);
  /** RBAC: unit cost and stock value are only shown with `finance:view`. */
  readonly showFinance = input(true);
  readonly closed = output();

  protected readonly placeholder = PLACEHOLDER_IMAGE;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }
}
