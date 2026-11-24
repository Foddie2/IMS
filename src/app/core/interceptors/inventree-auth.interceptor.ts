import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { INVENTREE_CONFIG } from '../services/inventree.config';

/** Adds InvenTree token auth and JSON accept headers to requests aimed at the InvenTree API. */
export const inventreeAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiUrl, token } = inject(INVENTREE_CONFIG);

  if (!apiUrl || !req.url.startsWith(apiUrl)) {
    return next(req);
  }

  const setHeaders: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    setHeaders['Authorization'] = `Token ${token}`;
  }
  return next(req.clone({ setHeaders }));
};
