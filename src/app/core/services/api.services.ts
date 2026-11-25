import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiStockStatus,
  AuditLogDto,
  CategoryDto,
  CreatePurchaseOrderRequest,
  CreateStockMovementRequest,
  CreateUserRequest,
  InventoryItemDto,
  InventorySummaryDto,
  LowStockItemDto,
  ProductDto,
  ProductUpsertRequest,
  PurchaseOrderDto,
  PurchaseOrderStatus,
  StockFlowPointDto,
  StockMovementDto,
  StockMovementResultDto,
  StockMovementType,
  SupplierDto,
  UpdateUserRequest,
  UserAdminDto,
  WarehouseDto,
} from '../models/api.models';

type QueryValue = string | number | boolean | null | undefined;

/** Builds query params, dropping null/undefined/empty values. */
function params(query: Record<string, QueryValue>): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      result = result.set(key, String(value));
    }
  }
  return result;
}

const api = (path: string) => `${environment.apiUrl}/${path}`;

/** Categories, warehouses and suppliers (reference data). */
@Service()
export class ReferenceDataService {
  private readonly http = inject(HttpClient);

  categories(): Observable<CategoryDto[]> {
    return this.http.get<CategoryDto[]>(api('categories'));
  }

  /** Warehouses the signed-in user can access. */
  warehouses(): Observable<WarehouseDto[]> {
    return this.http.get<WarehouseDto[]>(api('warehouses'));
  }

  suppliers(): Observable<SupplierDto[]> {
    return this.http.get<SupplierDto[]>(api('suppliers'));
  }
}

export interface ProductQuery {
  search?: string;
  categoryId?: number | null;
  stockStatus?: ApiStockStatus | null;
  warehouseId?: number | null;
}

@Service()
export class ProductService {
  private readonly http = inject(HttpClient);

  list(query: ProductQuery = {}): Observable<ProductDto[]> {
    return this.http.get<ProductDto[]>(api('products'), { params: params({ ...query }) });
  }

  get(id: number): Observable<ProductDto> {
    return this.http.get<ProductDto>(api(`products/${id}`));
  }

  create(request: ProductUpsertRequest): Observable<ProductDto> {
    return this.http.post<ProductDto>(api('products'), request);
  }

  update(id: number, request: ProductUpsertRequest): Observable<ProductDto> {
    return this.http.put<ProductDto>(api(`products/${id}`), request);
  }

  /** Soft delete (SuperAdmin). */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(api(`products/${id}`));
  }
}

@Service()
export class InventoryApiService {
  private readonly http = inject(HttpClient);

  list(query: { search?: string; categoryId?: number | null; warehouseId?: number | null } = {}): Observable<InventoryItemDto[]> {
    return this.http.get<InventoryItemDto[]>(api('inventory'), { params: params({ ...query }) });
  }

  lowStock(warehouseId?: number | null): Observable<LowStockItemDto[]> {
    return this.http.get<LowStockItemDto[]>(api('inventory/low-stock'), { params: params({ warehouseId }) });
  }
}

export interface StockMovementQuery {
  productId?: number | null;
  warehouseId?: number | null;
  type?: StockMovementType | null;
  take?: number;
}

@Service()
export class StockMovementService {
  private readonly http = inject(HttpClient);

  list(query: StockMovementQuery = {}): Observable<StockMovementDto[]> {
    return this.http.get<StockMovementDto[]>(api('stock-movements'), { params: params({ ...query }) });
  }

  /** Transactional on the server: validates stock, updates quantities, writes movement + audit log. */
  create(request: CreateStockMovementRequest): Observable<StockMovementResultDto> {
    return this.http.post<StockMovementResultDto>(api('stock-movements'), request);
  }
}

@Service()
export class ReportService {
  private readonly http = inject(HttpClient);

  inventorySummary(warehouseId?: number | null): Observable<InventorySummaryDto> {
    return this.http.get<InventorySummaryDto>(api('reports/inventory-summary'), { params: params({ warehouseId }) });
  }

  stockFlow(months = 12, warehouseId?: number | null): Observable<StockFlowPointDto[]> {
    return this.http.get<StockFlowPointDto[]>(api('reports/stock-flow'), { params: params({ months, warehouseId }) });
  }

  /** Admin+. */
  auditLogs(take = 100, entity?: string): Observable<AuditLogDto[]> {
    return this.http.get<AuditLogDto[]>(api('audit-logs'), { params: params({ take, entity }) });
  }
}

/** Admin+. */
@Service()
export class PurchaseOrderService {
  private readonly http = inject(HttpClient);

  list(status?: PurchaseOrderStatus | null): Observable<PurchaseOrderDto[]> {
    return this.http.get<PurchaseOrderDto[]>(api('purchase-orders'), { params: params({ status }) });
  }

  create(request: CreatePurchaseOrderRequest): Observable<PurchaseOrderDto> {
    return this.http.post<PurchaseOrderDto>(api('purchase-orders'), request);
  }
}

/** SuperAdmin. */
@Service()
export class UserAdminService {
  private readonly http = inject(HttpClient);

  list(): Observable<UserAdminDto[]> {
    return this.http.get<UserAdminDto[]>(api('users'));
  }

  create(request: CreateUserRequest): Observable<UserAdminDto> {
    return this.http.post<UserAdminDto>(api('users'), request);
  }

  update(id: number, request: UpdateUserRequest): Observable<UserAdminDto> {
    return this.http.put<UserAdminDto>(api(`users/${id}`), request);
  }
}
