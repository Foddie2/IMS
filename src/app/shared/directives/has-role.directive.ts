import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { Role } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';

/**
 * Renders its template only for the given roles and reacts to sign-in/out and role changes.
 *
 *   <button *appHasRole="['Admin', 'SuperAdmin']">New product</button>
 *
 * UI convenience only – the API rejects unauthorized calls regardless.
 */
@Directive({ selector: '[appHasRole]' })
export class HasRoleDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appHasRole = input.required<readonly Role[]>();

  private rendered = false;

  constructor() {
    effect(() => {
      const allowed = this.auth.hasRole(this.appHasRole());
      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
