import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROLE_LABELS } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-forbidden',
  imports: [IconComponent, RouterLink],
  template: `
    <div class="mx-auto max-w-xl rounded-sm border border-line bg-surface px-6 py-16 text-center shadow-sm">
      <span class="mx-auto mb-4 grid size-12 place-items-center rounded-sm bg-red-50 text-bad-ink dark:bg-red-500/15">
        <app-icon name="lock" class="size-6" />
      </span>
      <h1 class="text-xl font-bold text-ink">You don't have access to this page</h1>
      <p class="mt-2 text-sm text-ink-muted">
        Your role, <span class="font-semibold text-ink">{{ roleLabels[auth.user().role] }}</span>, doesn't include this permission.
        Ask an administrator for access.
      </p>
      <a
        routerLink="/dashboard"
        class="mt-6 inline-flex rounded-sm bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Back to dashboard
      </a>
    </div>
  `,
})
export class ForbiddenComponent {
  protected readonly auth = inject(AuthService);
  protected readonly roleLabels = ROLE_LABELS;
}
