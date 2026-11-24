import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import {
  InvenTreeCategory,
  InvenTreeListResponse,
  InvenTreePart,
  InvenTreeRoles,
  InvenTreeStock,
  InvenTreeUser,
} from '../models/inventree.models';
import { unwrapList } from '../utils/inventory.mapper';
import { INVENTREE_CONFIG } from './inventree.config';

type QueryParams = Record<string, string | number | boolean>;

/** Parallel page requests per list endpoint – keeps load on InvenTree reasonable. */
const PAGE_CONCURRENCY = 4;

/** Thin, typed HTTP client for the InvenTree REST endpoints used by the dashboard. */
@Service()
export class InvenTreeApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(INVENTREE_CONFIG);

  readonly isConfigured = this.config.apiUrl.length > 0;
  /** Direct-mode token in the browser: user endpoints then identify the real InvenTree user. */
  readonly hasToken = this.isConfigured && this.config.token.length > 0;

  /** Base for media paths: `/inventree` (proxy) or `https://host` (direct). */
  private readonly mediaBase = this.config.apiUrl.replace(/\/api$/, '');

  getParts(): Observable<InvenTreePart[]> {
    return this.listAll<InvenTreePart>('part/', { active: true, category_detail: true });
  }

  getCategories(): Observable<InvenTreeCategory[]> {
    return this.listAll<InvenTreeCategory>('part/category/', {});
  }

  getStockItems(): Observable<InvenTreeStock[]> {
    return this.listAll<InvenTreeStock>('stock/', {
      in_stock: true,
      location_detail: true,
      ordering: '-updated',
    });
  }

  getCurrentUser(): Observable<InvenTreeUser> {
    return this.http.get<InvenTreeUser>(`${this.config.apiUrl}/user/me/`);
  }

  getUserRoles(): Observable<InvenTreeRoles> {
    return this.http.get<InvenTreeRoles>(`${this.config.apiUrl}/user/roles/`);
  }

  /** Turns server-relative media paths (`/media/...`) into URLs the browser can load. */
  resolveMediaUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }
    return /^https?:\/\//.test(path) ? path : `${this.mediaBase}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /** Deep link to the part page in the InvenTree web UI, or `null` when no web URL is set. */
  partUrl(partId: number): string | null {
    return this.config.webUrl ? `${this.config.webUrl}/web/part/${partId}/details` : null;
  }

  /**
   * Fetches every page of a list endpoint. The first page reports `count`; remaining
   * pages are requested by offset (not via `next`, whose absolute URL would bypass the proxy).
   */
  private listAll<T>(path: string, params: QueryParams): Observable<T[]> {
    const { pageSize } = this.config;
    const page = (offset: number) =>
      this.http.get<InvenTreeListResponse<T>>(`${this.config.apiUrl}/${path}`, {
        params: new HttpParams({ fromObject: { ...params, limit: pageSize, offset } }),
      });

    return page(0).pipe(
      switchMap((first) => {
        if (Array.isArray(first) || first.count <= first.results.length) {
          return of(unwrapList(first));
        }
        const offsets: number[] = [];
        for (let offset = pageSize; offset < first.count; offset += pageSize) {
          offsets.push(offset);
        }
        return from(offsets).pipe(
          mergeMap((offset) => page(offset).pipe(map(unwrapList)), PAGE_CONCURRENCY),
          toArray(),
          map((rest) => [first.results, ...rest].flat()),
        );
      }),
    );
  }
}
