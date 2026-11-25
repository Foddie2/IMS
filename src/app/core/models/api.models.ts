/**
 * Typed contract of the IMS ASP.NET Core API (mirrors backend/src/Ims.Api/Contracts/Dtos.cs).
 * Enums are serialized as strings; dates are ISO-8601 UTC strings.
 */

export type Role = 'User' | 'Admin' | 'SuperAdmin';
export type ApiStockStatus = 'InStock' | 'LowStock' | 'OutOfStock';
export type StockMovementType = 'Inbound' | 'Outbound' | 'Adjustment' | 'Transfer';
export type PurchaseOrderStatus = 'Draft' | 'Submitted' | 'Received' | 'Cancelled';

// ---------------------------------------------------------------- auth & users

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserDto {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  assignedWarehouseIds: number[];
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: UserDto;
}

export interface UserAdminDto extends UserDto {
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  assignedWarehouseIds: number[];
}

export interface UpdateUserRequest {
  fullName: string;
  role: Role;
  assignedWarehouseIds: number[];
  isActive: boolean;
}

// ---------------------------------------------------------------- catalogue

export interface CategoryDto {
  id: number;
  name: string;
  description: string;
  productCount: number;
}

export interface WarehouseDto {
  id: number;
  code: string;
  name: string;
  city: string;
  mapX: number;
  mapY: number;
  isActive: boolean;
}

export interface SupplierDto {
  id: number;
  name: string;
  contactEmail: string | null;
  phone: string | null;
  leadTimeDays: number;
}

export interface ProductDto {
  id: number;
  sku: string;
  name: string;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
  /** `null` for the User role. */
  unitPrice: number | null;
  units: string;
  minimumStock: number;
  barcode: string | null;
  imageUrl: string | null;
  totalQuantity: number;
  stockStatus: ApiStockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductUpsertRequest {
  sku: string;
  name: string;
  description: string | null;
  categoryId: number | null;
  unitPrice: number;
  units: string;
  minimumStock: number;
  barcode: string | null;
  imageUrl: string | null;
}

// ---------------------------------------------------------------- inventory

export interface WarehouseStockDto {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  updatedAt: string;
}

export interface InventoryItemDto {
  productId: number;
  sku: string;
  name: string;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
  unitPrice: number | null;
  units: string;
  minimumStock: number;
  barcode: string | null;
  imageUrl: string | null;
  totalQuantity: number;
  stockStatus: ApiStockStatus;
  warehouses: WarehouseStockDto[];
}

export interface LowStockItemDto {
  productId: number;
  sku: string;
  name: string;
  totalQuantity: number;
  minimumStock: number;
  shortfall: number;
  stockStatus: ApiStockStatus;
}

// ---------------------------------------------------------------- stock movements

export interface CreateStockMovementRequest {
  productId: number;
  warehouseId: number;
  type: StockMovementType;
  /** Inbound/Outbound/Transfer: positive units. Adjustment: signed correction. */
  quantity: number;
  destinationWarehouseId: number | null;
  referenceNumber: string | null;
  notes: string | null;
}

export interface StockMovementDto {
  id: number;
  productId: number;
  productSku: string;
  productName: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  type: StockMovementType;
  quantityDelta: number;
  referenceNumber: string | null;
  notes: string | null;
  performedByUserId: number | null;
  performedByName: string | null;
  createdAt: string;
}

export interface StockMovementResultDto {
  movements: StockMovementDto[];
  updatedStock: WarehouseStockDto[];
}

// ---------------------------------------------------------------- purchase orders

export interface PurchaseOrderItemRequest {
  productId: number;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchaseOrderRequest {
  supplierId: number;
  warehouseId: number;
  items: PurchaseOrderItemRequest[];
  status: 'Draft' | 'Submitted' | null;
}

export interface PurchaseOrderItemDto {
  productId: number;
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrderDto {
  id: number;
  orderNumber: string;
  supplierId: number;
  supplierName: string;
  warehouseId: number;
  warehouseName: string;
  status: PurchaseOrderStatus;
  totalAmount: number;
  createdAt: string;
  items: PurchaseOrderItemDto[];
}

// ---------------------------------------------------------------- reports & audit

export interface CategoryBreakdownDto {
  categoryId: number | null;
  categoryName: string;
  productCount: number;
  units: number;
  value: number | null;
}

export interface InventorySummaryDto {
  totalItems: number;
  skuCount: number;
  totalStockValue: number | null;
  lowStockCount: number;
  outOfStockCount: number;
  pendingPurchaseOrders: number;
  purchaseOrdersLast30Days: number;
  shipmentsToday: number;
  shipmentsTrend: number[];
  categoryBreakdown: CategoryBreakdownDto[];
  recentActivity: StockMovementDto[];
  generatedAt: string;
}

export interface StockFlowPointDto {
  year: number;
  month: number;
  label: string;
  inbound: number;
  outbound: number;
  closingStock: number;
}

export interface AuditLogDto {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entityName: string;
  entityId: string | null;
  details: string | null;
  timestamp: string;
}

/** RFC 7807 error body returned by the API. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
  available?: number;
  requested?: number;
}
