import { Component, ElementRef, effect, inject, untracked, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Permission } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <a
      href="#main-content"
      class="sr-only z-50 rounded-lg bg-surface px-4 py-2 text-sm font-semibold text-accent-ink shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to main content
    </a>

    <!-- Desktop sidebar. User-dependent chrome skips hydration: the persona/role is only known in the browser. -->
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line lg:block">
      <app-sidebar ngSkipHydration />
    </aside>

    <!-- Mobile sidebar: native modal dialog gives focus trapping, Escape and inert background. -->
    <dialog
      #mobileNav
      aria-label="Navigation"
      class="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-surface p-0 shadow-xl backdrop:bg-slate-950/60 lg:hidden"
      (click)="onDialogClick($event)"
    >
      <app-sidebar ngSkipHydration [dismissible]="true" (closed)="closeSidebar()" (navigated)="closeSidebar()" />
    </dialog>

    <div class="lg:pl-64">
      <app-topbar ngSkipHydration (menuToggled)="openSidebar()" />
      <main id="main-content" tabindex="-1" class="px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
        <router-outlet />
      </main>
    </div>
  `,
  host: { class: 'block min-h-dvh bg-canvas' },
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly mobileNav = viewChild.required<ElementRef<HTMLDialogElement>>('mobileNav');

  constructor() {
    // Session ended (sign-out, expiry, revoked in another tab) → back to the login page.
    effect(() => {
      if (this.auth.ready() && !this.auth.isAuthenticated()) {
        untracked(() => void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } }));
      }
    });

    // Switching persona/role at runtime must not leave the user on a page they can no longer access.
    effect(() => {
      if (!this.auth.accessReady()) return;
      this.auth.permissions();
      untracked(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        const required = route.data['permission'] as Permission | undefined;
        if (required && !this.auth.can(required)) {
          void this.router.navigate(['/forbidden']);
        }
      });
    });
  }

  protected openSidebar(): void {
    this.mobileNav().nativeElement.showModal();
  }

  protected closeSidebar(): void {
    this.mobileNav().nativeElement.close();
  }

  /** Clicks on the ::backdrop land on the <dialog> element itself. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.mobileNav().nativeElement) {
      this.closeSidebar();
    }
  }
}
