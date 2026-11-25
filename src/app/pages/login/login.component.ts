import { Component, inject, input, signal } from '@angular/core';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared/components/icon.component';

interface Credentials {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  imports: [FormField, IconComponent],
  template: `
    <main class="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div class="w-full max-w-sm">
        <div class="mb-8 flex items-center justify-center gap-2.5">
          <span class="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/30">
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

        <div class="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 class="text-lg font-semibold text-ink">Sign in</h1>
          <p class="mt-1 text-sm text-ink-muted">Use the account your administrator created for you.</p>

          @if (error(); as message) {
            <div class="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-bad-ink dark:border-red-500/30 dark:bg-red-500/10" role="alert">
              <app-icon name="alert" class="mt-0.5 size-4" />
              <span>{{ message }}</span>
            </div>
          }

          <form class="mt-6 space-y-4" novalidate (submit)="onSubmit($event)">
            <div>
              <label for="login-email" class="mb-1 block text-sm font-medium text-ink-secondary">Email</label>
              <input
                id="login-email"
                type="email"
                autocomplete="username"
                class="h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none aria-invalid:border-red-500"
                [formField]="loginForm.email"
                [attr.aria-invalid]="showErrors(loginForm.email().invalid(), loginForm.email().touched())"
                [attr.aria-describedby]="showErrors(loginForm.email().invalid(), loginForm.email().touched()) ? 'login-email-error' : null"
              />
              @if (showErrors(loginForm.email().invalid(), loginForm.email().touched())) {
                <p id="login-email-error" class="mt-1 text-xs text-bad-ink">{{ loginForm.email().errors()[0]?.message }}</p>
              }
            </div>

            <div>
              <label for="login-password" class="mb-1 block text-sm font-medium text-ink-secondary">Password</label>
              <input
                id="login-password"
                type="password"
                autocomplete="current-password"
                class="h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 focus:outline-none aria-invalid:border-red-500"
                [formField]="loginForm.password"
                [attr.aria-invalid]="showErrors(loginForm.password().invalid(), loginForm.password().touched())"
                [attr.aria-describedby]="showErrors(loginForm.password().invalid(), loginForm.password().touched()) ? 'login-password-error' : null"
              />
              @if (showErrors(loginForm.password().invalid(), loginForm.password().touched())) {
                <p id="login-password-error" class="mt-1 text-xs text-bad-ink">{{ loginForm.password().errors()[0]?.message }}</p>
              }
            </div>

            <button
              type="submit"
              class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-70"
              [disabled]="loginForm().submitting()"
            >
              @if (loginForm().submitting()) {
                <app-icon name="reset" class="size-4 animate-spin" /> Signing in…
              } @else {
                Sign in
              }
            </button>
          </form>
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

  protected readonly error = signal<string | null>(null);
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
    this.error.set(null);
    await submit(this.loginForm, async () => {
      const { email: address, password } = this.credentials();
      const failure = await this.auth.signIn(address.trim(), password);
      if (failure) {
        this.error.set(failure === 'Invalid login credentials' ? 'Incorrect email or password.' : failure);
        return undefined;
      }
      const target = this.returnUrl();
      await this.router.navigateByUrl(target?.startsWith('/') && !target.startsWith('//') ? target : '/dashboard');
      return undefined;
    });
  }
}
