import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toaster',
  imports: [IconComponent],
  template: `
    <div class="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2" role="status" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-sm border px-4 py-3 text-sm shadow-lg"
          [class]="
            toast.tone === 'error'
              ? 'border-red-200 bg-red-50 text-bad-ink dark:border-red-500/30 dark:bg-red-950'
              : toast.tone === 'success'
                ? 'border-green-200 bg-green-50 text-good-ink dark:border-green-500/30 dark:bg-green-950'
                : 'border-line bg-surface text-ink'
          "
        >
          <app-icon [name]="toast.tone === 'error' ? 'alert' : 'check'" class="mt-0.5 size-4" />
          <p class="min-w-0 flex-1">{{ toast.message }}</p>
          <button
            type="button"
            class="-m-1 grid size-6 place-items-center rounded opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            (click)="toasts.dismiss(toast.id)"
          >
            <app-icon name="close" class="size-4" />
            <span class="sr-only">Dismiss</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToasterComponent {
  protected readonly toasts = inject(ToastService);
}
