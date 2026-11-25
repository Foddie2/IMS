import { Service, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

/** App-wide notifications, rendered by <app-toaster> in the main layout (announced via role="status"). */
@Service()
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<readonly Toast[]>([]);

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 6000);
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(message: string, tone: Toast['tone'], durationMs = 3500): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, message, tone }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
