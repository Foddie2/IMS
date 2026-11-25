import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormField, email, form, minLength, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { Role, UserAdminDto } from '../../core/models/api.models';
import { ROLES, ROLE_LABELS } from '../../core/models/auth.models';
import { ReferenceDataService, UserAdminService } from '../../core/services/api.services';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { fieldErrorMessage, showFieldError } from '../../shared/utils/field-status';

interface UserModel {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
}

/** SuperAdmin: users, roles and warehouse assignments. */
@Component({
  selector: 'app-users-page',
  imports: [DatePipe, FormField, IconComponent, ModalComponent, PageHeaderComponent],
  template: `
    <div class="mx-auto max-w-[1600px]">
      <app-page-header heading="Users & Access" description="Roles decide what people can do; warehouse assignments limit where Users can work.">
        <button type="button" class="btn-primary" (click)="open(null)">
          <app-icon name="shield" class="size-4" /> Add user
        </button>
      </app-page-header>

      <section class="rounded-sm border border-line bg-surface shadow-sm" aria-label="Users">
        @if (users.error(); as error) {
          <p class="px-5 py-10 text-center text-sm text-bad-ink" role="alert">{{ errorText(error) }}</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="data-table min-w-[820px]">
              <caption class="sr-only">Users</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Warehouses</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last sign-in</th>
                  <th scope="col" class="text-right"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (u of (users.hasValue() ? users.value() : []); track u.id) {
                  <tr>
                    <td><span class="block font-medium text-ink">{{ u.fullName }}</span><span class="text-xs text-ink-subtle">{{ u.email }}</span></td>
                    <td><span class="rounded-sm bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">{{ roleLabels[u.role] }}</span></td>
                    <td class="text-xs">{{ u.role === 'User' ? warehouseNames(u.assignedWarehouseIds) : 'All warehouses' }}</td>
                    <td>
                      <span class="inline-flex items-center gap-1.5 text-xs font-medium" [class]="u.isActive ? 'text-good-ink' : 'text-ink-subtle'">
                        <span class="size-2 rounded-full" [class]="u.isActive ? 'bg-[#0ca30c]' : 'bg-ink-faint'" aria-hidden="true"></span>
                        {{ u.isActive ? 'Active' : 'Disabled' }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap text-xs">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'MMM d, y · HH:mm') : 'Never' }}</td>
                    <td class="text-right">
                      <button type="button" class="rounded-sm px-2.5 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-blue-600" (click)="open(u)">
                        Edit<span class="sr-only"> {{ u.fullName }}</span>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="py-10 text-center text-ink-subtle">Loading users…</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>

    <app-modal [heading]="editing() ? 'Edit ' + editing()!.fullName : 'Add user'" (closed)="error.set(null)">
      <form id="user-form" class="space-y-4" novalidate (submit)="onSubmit($event)">
        @if (error(); as message) {
          <div class="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-bad-ink dark:border-red-500/30 dark:bg-red-500/10" role="alert">
            <app-icon name="alert" class="mt-0.5 size-4" /><span>{{ message }}</span>
          </div>
        }
        <div>
          <label for="u-name" class="form-label">Full name</label>
          <input id="u-name" type="text" class="form-input" [formField]="userForm.fullName" />
          @if (show(userForm.fullName())) {
            <p class="form-error">{{ message(userForm.fullName()) }}</p>
          }
        </div>
        @if (!editing()) {
          <div>
            <label for="u-email" class="form-label">Email</label>
            <input id="u-email" type="email" class="form-input" autocomplete="off" [formField]="userForm.email" />
            @if (show(userForm.email())) {
              <p class="form-error">{{ message(userForm.email()) }}</p>
            }
          </div>
          <div>
            <label for="u-password" class="form-label">Initial password</label>
            <input id="u-password" type="password" class="form-input" autocomplete="new-password" [formField]="userForm.password" />
            @if (show(userForm.password())) {
              <p class="form-error">{{ message(userForm.password()) }}</p>
            }
          </div>
        }
        <div>
          <label for="u-role" class="form-label">Role</label>
          <select id="u-role" class="form-input" [formField]="userForm.role">
            @for (r of roles; track r) {
              <option [value]="r">{{ roleLabels[r] }}</option>
            }
          </select>
        </div>
        @if (model().role === 'User') {
          <fieldset>
            <legend class="form-label">Assigned warehouses</legend>
            <div class="grid gap-2 sm:grid-cols-2">
              @for (w of (warehouses.hasValue() ? warehouses.value() : []); track w.id) {
                <label class="flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm">
                  <input type="checkbox" class="size-4 accent-blue-600" [checked]="assigned().has(w.id)" (change)="toggleWarehouse(w.id)" />
                  {{ w.name }}
                </label>
              }
            </div>
            @if (assigned().size === 0) {
              <p class="mt-1 text-xs text-warn-ink">Without a warehouse this user can't see any stock.</p>
            }
          </fieldset>
        }
        @if (editing()) {
          <label class="flex items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" class="size-4 accent-blue-600" [formField]="userForm.isActive" />
            Account active (can sign in)
          </label>
        }
      </form>
      <ng-container modalFooter>
        <button type="button" class="btn-secondary" (click)="modal().close()">Cancel</button>
        <button type="submit" form="user-form" class="btn-primary" [disabled]="busy()">{{ busy() ? 'Saving…' : editing() ? 'Save changes' : 'Create user' }}</button>
      </ng-container>
    </app-modal>
  `,
})
export class UsersPageComponent {
  private readonly api = inject(UserAdminService);
  private readonly reference = inject(ReferenceDataService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly modal = viewChild.required(ModalComponent);
  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly show = showFieldError;
  protected readonly message = fieldErrorMessage;

  private readonly reloadToken = signal(0);
  protected readonly users = rxResource({
    params: () => (this.auth.isAuthenticated() ? this.reloadToken() : undefined),
    stream: () => this.api.list(),
  });
  protected readonly warehouses = rxResource({
    params: () => this.auth.isAuthenticated() || undefined,
    stream: () => this.reference.warehouses(),
  });

  protected readonly editing = signal<UserAdminDto | null>(null);
  protected readonly assigned = signal<ReadonlySet<number>>(new Set());
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly model = signal<UserModel>({ fullName: '', email: '', password: '', role: 'User', isActive: true });
  protected readonly userForm = form(this.model, (path) => {
    required(path.fullName, { message: 'Enter a name.' });
    validate(path.email, ({ value }) =>
      this.editing() || value().trim() ? undefined : { kind: 'required', message: 'Enter an email address.' },
    );
    email(path.email, { message: 'Enter a valid email address.' });
    validate(path.password, ({ value }) =>
      this.editing() || value().length >= 8 ? undefined : { kind: 'minLength', message: 'At least 8 characters.' },
    );
  });

  private readonly warehouseNamesById = computed(
    () => new Map(((this.warehouses.hasValue() ? this.warehouses.value() : [])).map((w) => [w.id, w.name])),
  );

  protected warehouseNames(ids: readonly number[]): string {
    return ids.length ? ids.map((id) => this.warehouseNamesById().get(id) ?? `#${id}`).join(', ') : 'None assigned';
  }

  protected open(user: UserAdminDto | null): void {
    this.editing.set(user);
    this.error.set(null);
    this.model.set({
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'User',
      isActive: user?.isActive ?? true,
    });
    this.assigned.set(new Set(user?.assignedWarehouseIds ?? []));
    this.modal().open();
  }

  protected toggleWarehouse(id: number): void {
    this.assigned.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected errorText(error: unknown): string {
    return apiErrorMessage(error, 'Users could not be loaded.');
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.userForm, async () => {
      const m = this.model();
      const warehouseIds = m.role === 'User' ? [...this.assigned()] : [];
      const existing = this.editing();
      this.busy.set(true);
      this.error.set(null);
      try {
        if (existing) {
          await firstValueFrom(
            this.api.update(existing.id, { fullName: m.fullName.trim(), role: m.role, assignedWarehouseIds: warehouseIds, isActive: m.isActive }),
          );
          // Your own role/assignments may have changed.
          if (existing.id === this.auth.userId()) await this.auth.refreshProfile();
        } else {
          await firstValueFrom(
            this.api.create({ fullName: m.fullName.trim(), email: m.email.trim(), password: m.password, role: m.role, assignedWarehouseIds: warehouseIds }),
          );
        }
        this.toast.success(existing ? `Updated ${m.fullName}.` : `Created ${m.fullName}.`);
        this.modal().close();
        this.reloadToken.update((v) => v + 1);
      } catch (error) {
        this.error.set(apiErrorMessage(error, 'The user could not be saved.'));
      } finally {
        this.busy.set(false);
      }
      return undefined;
    });
  }
}
