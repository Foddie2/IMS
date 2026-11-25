import { Component, inject, input, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Role } from '../../core/models/api.models';
import { ROLE_LABELS } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon.component';

interface Credentials {
  email: string;
  password: string;
}

/** Seeded by the API's DbInitializer (demo environments only). */
const DEMO_ACCOUNTS: readonly { role: Role; email: string; password: string; hint: string }[] = [
  { role: 'SuperAdmin', email: 'admin@ims.com', password: 'Admin123!', hint: 'Everything, incl. users & deletes' },
  { role: 'Admin', email: 'manager@ims.com', password: 'Manager123!', hint: 'Products, orders, reports' },
  { role: 'User', email: 'operator@ims.com', password: 'Operator123!', hint: 'Stock moves · 2 warehouses' },
];

@Component({
  selector: 'app-login',
  imports: [FormField, IconComponent],
  template: `
    <main class="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div class="w-full max-w-sm">
        <div class="mb-8 flex items-center justify-center gap-2.5">
          <span class="grid size-10 place-items-center rounded-sm bg-blue-600 text-white shadow-sm shadow-blue-600/30">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
              <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" />
              <path d="m3 7 9 5 9-5M12 12v10" />
            </svg>
          </span>
          <span class="flex flex-col leading-tight">
            <span class="text-xl font-bold tracking-tight text-ink">IMS</span>
            <span class="text-xs font-medium text-ink-subtle">Inventory Management System</span>
          </span>
        </div>

        <div class="rounded-sm border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 class="text-lg font-semibold text-ink">Sign in</h1>
          <p class="mt-1 text-sm text-ink-muted">Use the account your administrator created for you.</p>

          @if (error(); as message) {
            <div class="mt-4 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-bad-ink dark:border-red-500/30 dark:bg-red-500/10" role="alert">
              <app-icon name="alert" class="mt-0.5 size-4" />
              <span>{{ message }}</span>
            </div>
          }

          <form class="mt-6 space-y-4" novalidate (submit)="onSubmit($event)">
            <div>
              <label for="login-email" class="form-label">Email</label>
              <input
                id="login-email"
                type="email"
                autocomplete="username"
                class="form-input h-11"
                [formField]="loginForm.email"
                [attr.aria-invalid]="showErrors(loginForm.email().invalid(), loginForm.email().touched())"
                [attr.aria-describedby]="showErrors(loginForm.email().invalid(), loginForm.email().touched()) ? 'login-email-error' : null"
              />
              @if (showErrors(loginForm.email().invalid(), loginForm.email().touched())) {
                <p id="login-email-error" class="form-error">{{ loginForm.email().errors()[0]?.message }}</p>
              }
            </div>

            <div>
              <label for="login-password" class="form-label">Password</label>
              <input
                id="login-password"
                type="password"
                autocomplete="current-password"
                class="form-input h-11"
                [formField]="loginForm.password"
                [attr.aria-invalid]="showErrors(loginForm.password().invalid(), loginForm.password().touched())"
                [attr.aria-describedby]="showErrors(loginForm.password().invalid(), loginForm.password().touched()) ? 'login-password-error' : null"
              />
              @if (showErrors(loginForm.password().invalid(), loginForm.password().touched())) {
                <p id="login-password-error" class="form-error">{{ loginForm.password().errors()[0]?.message }}</p>
              }
            </div>

            <button type="submit" class="btn-primary h-11 w-full" [disabled]="busy()">
              @if (busy()) {
                <app-icon name="reset" class="size-4 animate-spin" /> Signing in…
              } @else {
                Sign in
              }
            </button>
          </form>

          @if (showDemoLogins) {
            <div class="mt-6 border-t border-line pt-5">
              <p class="mb-2 text-xs font-semibold tracking-wider text-ink-subtle uppercase">Demo accounts</p>
              <ul class="space-y-2">
                @for (account of demoAccounts; track account.role) {
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center gap-3 rounded-sm border border-line px-3 py-2 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-60"
                      [disabled]="busy()"
                      (click)="useDemo(account.email, account.password)"
                    >
                      <span class="grid size-8 shrink-0 place-items-center rounded-sm bg-accent-soft text-accent-ink">
                        <app-icon name="shield" class="size-4" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block text-sm font-semibold text-ink">Sign in as {{ roleLabels[account.role] }}</span>
                        <span class="block truncate text-xs text-ink-subtle">{{ account.email }} · {{ account.hint }}</span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
      </div>
    </main>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Bound from the `?returnUrl=` query param by the router. */
  readonly returnUrl = input<string>();

  protected readonly showDemoLogins = environment.showDemoLogins;
  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  private readonly credentials = signal<Credentials>({ email: '', password: '' });
  protected readonly loginForm = form(this.credentials, (path) => {
    required(path.email, { message: 'Enter your email address.' });
    email(path.email, { message: 'Enter a valid email address.' });
    required(path.password, { message: 'Enter your password.' });
  });

  protected showErrors(invalid: boolean, touched: boolean): boolean {
    return invalid && touched;
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.loginForm, async () => {
      await this.signIn();
      return undefined;
    });
  }

  /** One click: fill the form with a demo account and sign in. */
  protected async useDemo(address: string, password: string): Promise<void> {
    this.credentials.set({ email: address, password });
    await this.signIn();
  }

  private async signIn(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    const { email: address, password } = this.credentials();
    const failure = await this.auth.login(address.trim(), password);
    this.busy.set(false);
    if (failure) {
      this.error.set(failure);
      return;
    }
    const target = this.returnUrl();
    await this.router.navigateByUrl(target?.startsWith('/') && !target.startsWith('//') ? target : '/dashboard');
  }
}
