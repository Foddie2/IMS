import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';

let nextModalId = 0;

/**
 * Accessible modal on the native <dialog>: focus trap, Escape to close and an inert
 * background come from the browser. Content goes in the default slot, buttons in [modalFooter].
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  template: `
    <dialog
      #dialog
      class="m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-hidden rounded-sm border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
      [class]="size() === 'lg' ? 'max-w-3xl' : 'max-w-lg'"
      [attr.aria-labelledby]="titleId"
      (close)="closed.emit()"
    >
      <div class="flex max-h-[90dvh] flex-col">
        <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div class="min-w-0">
            <h2 [id]="titleId" class="text-lg font-semibold">{{ heading() }}</h2>
            @if (description()) {
              <p class="mt-0.5 text-sm text-ink-muted">{{ description() }}</p>
            }
          </div>
          <button
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-sm text-ink-subtle hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-blue-600"
            (click)="close()"
          >
            <app-icon name="close" class="size-5" />
            <span class="sr-only">Close</span>
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ng-content />
        </div>
        <footer class="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3">
          <ng-content select="[modalFooter]" />
        </footer>
      </div>
    </dialog>
  `,
})
export class ModalComponent {
  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly size = input<'md' | 'lg'>('md');
  readonly closed = output();

  protected readonly titleId = `modal-title-${nextModalId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(): void {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }
}
