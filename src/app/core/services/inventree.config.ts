import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { Environment } from '../../../environments/environment.model';

export type InvenTreeConfig = Environment['inventree'];

export const INVENTREE_CONFIG = new InjectionToken<InvenTreeConfig>('INVENTREE_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    ...environment.inventree,
    apiUrl: environment.inventree.apiUrl.replace(/\/+$/, ''),
    webUrl: environment.inventree.webUrl.replace(/\/+$/, ''),
  }),
});
