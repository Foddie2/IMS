import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-xl px-6 py-16 text-center">
      <p class="text-sm font-semibold text-accent-ink">404</p>
      <h1 class="mt-2 text-2xl font-bold text-ink">Page not found</h1>
      <p class="mt-2 text-sm text-ink-muted">The page you're looking for doesn't exist or has moved.</p>
      <a
        routerLink="/dashboard"
        class="mt-6 inline-flex rounded-sm bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Back to dashboard
      </a>
    </div>
  `,
})
export class NotFoundComponent {}
