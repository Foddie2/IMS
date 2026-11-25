import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { InventoryItem } from '../../../core/models/inventory.models';
import { IconComponent } from '../../../shared/components/icon.component';

const MENU_WIDTH = 192;

/**
 * Ellipsis menu built on the native Popover API: it renders in the top layer
 * (never clipped by the scrolling table), with light-dismiss and Escape for free.
 */
@Component({
  selector: 'app-row-actions-menu',
  imports: [IconComponent],
  template: `
    <button
      #trigger
      type="button"
      class="grid size-9 place-items-center rounded-lg text-ink-subtle hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600"
      [attr.popovertarget]="menuId()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="menuId()"
    >
      <app-icon name="more" class="size-5" />
      <span class="sr-only">More actions for {{ item().name }}</span>
    </button>

    <div
      #menu
      popover
      [id]="menuId()"
      class="inset-auto m-0 w-48 rounded-xl border border-line bg-surface p-1 text-sm shadow-xl"
      [style.position]="'fixed'"
      [style.top.px]="position().top"
      [style.left.px]="position().left"
      (toggle)="onToggle($event)"
    >
      <ul>
        <li>
          <button type="button" class="menu-item" (click)="choose('view')">
            <app-icon name="eye" class="size-4 text-ink-subtle" /> View details
          </button>
        </li>
        <li>
          <button type="button" class="menu-item" (click)="choose('copy')">
            <app-icon name="copy" class="size-4 text-ink-subtle" /> Copy SKU
          </button>
        </li>
      </ul>
    </div>
  `,
  styles: `
    .menu-item {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 0.625rem;
      border-radius: 0.5rem;
      padding: 0.5rem 0.75rem;
      text-align: left;
      color: var(--color-slate-700, #334155);
    }
    .menu-item:hover,
    .menu-item:focus-visible {
      background: var(--color-slate-100, #f1f5f9);
      color: var(--color-slate-900, #0f172a);
      outline: none;
    }
  `,
  host: { class: 'inline-block' },
})
export class RowActionsMenuComponent {
  readonly item = input.required<InventoryItem>();
  readonly view = output();
  readonly copySku = output();

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');

  protected readonly open = signal(false);
  protected readonly position = signal({ top: 0, left: 0 });
  protected readonly menuId = computed(() => `row-menu-${this.item().id}`);

  protected onToggle(event: Event): void {
    const isOpen = (event as ToggleEvent).newState === 'open';
    this.open.set(isOpen);
    if (!isOpen) return;

    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const menuHeight = this.menu().nativeElement.offsetHeight;
    const below = rect.bottom + 4;
    this.position.set({
      top: below + menuHeight > viewportHeight ? Math.max(8, rect.top - menuHeight - 4) : below,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
    this.menu().nativeElement.querySelector<HTMLElement>('.menu-item')?.focus();
  }

  protected choose(action: 'view' | 'copy'): void {
    this.close();
    if (action === 'view') this.view.emit();
    else this.copySku.emit();
  }

  protected close(): void {
    this.menu().nativeElement.hidePopover();
    this.trigger().nativeElement.focus();
  }
}
