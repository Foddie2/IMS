import {
  ApiStockStatus,
  InventoryItemDto,
  InventorySummaryDto,
  StockFlowPointDto,
  StockMovementDto,
  WarehouseDto,
} from '../models/api.models';
import {
  ActivityEvent,
  ActivityType,
  InventoryItem,
  InventorySnapshot,
  ReportSnapshot,
  Site,
  StockStatus,
} from '../models/inventory.models';

const STATUS_MAP: Record<ApiStockStatus, StockStatus> = {
  InStock: 'in-stock',
  LowStock: 'low-stock',
  OutOfStock: 'out-of-stock',
};

export const STOCK_STATUS_TO_API: Record<StockStatus, ApiStockStatus> = {
  'in-stock': 'InStock',
  'low-stock': 'LowStock',
  'out-of-stock': 'OutOfStock',
};

export function toStockStatus(status: ApiStockStatus): StockStatus {
  return STATUS_MAP[status];
}

/** Same rule as the API (`StockStatusRules.For`), used when re-scoping stock to one site. */
export function deriveStockStatus(stock: number, minimumStock: number): StockStatus {
  if (stock <= 0) return 'out-of-stock';
  if (minimumStock > 0 && stock <= minimumStock) return 'low-stock';
  return 'in-stock';
}

export function mapWarehouse(w: WarehouseDto): Site {
  return { id: String(w.id), name: w.name, city: w.city, x: Number(w.mapX), y: Number(w.mapY) };
}

export function mapInventoryItem(dto: InventoryItemDto, siteNames: ReadonlyMap<string, string>): InventoryItem {
  const stockBySite: Record<string, number> = {};
  for (const w of dto.warehouses) {
    stockBySite[String(w.warehouseId)] = w.quantity;
  }
  const primary = [...dto.warehouses].sort((a, b) => b.quantity - a.quantity)[0];
  return {
    id: dto.productId,
    name: dto.name,
    description: dto.description,
    sku: dto.sku,
    category: dto.categoryName ?? 'Uncategorized',
    stock: dto.totalQuantity,
    minimumStock: dto.minimumStock,
    unitPrice: dto.unitPrice ?? 0,
    units: dto.units || 'pcs',
    status: toStockStatus(dto.stockStatus),
    barcode: dto.barcode || dto.sku,
    imageUrl: dto.imageUrl,
    location: primary && primary.quantity > 0 ? (siteNames.get(String(primary.warehouseId)) ?? primary.warehouseName) : 'No stock',
    stockBySite,
  };
}

export function mapInventorySnapshot(
  warehouses: readonly WarehouseDto[],
  inventory: readonly InventoryItemDto[],
  syncedAt: string,
): InventorySnapshot {
  const sites = warehouses.filter((w) => w.isActive).map(mapWarehouse);
  const siteNames = new Map(sites.map((s) => [s.id, s.name]));
  const items = inventory.map((dto) => mapInventoryItem(dto, siteNames));
  return {
    syncedAt,
    sites,
    items,
    categories: [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b)),
  };
}

const MOVEMENT_ACTIVITY: Record<StockMovementDto['type'], { type: ActivityType; verb: string }> = {
  Inbound: { type: 'received', verb: 'Received' },
  Outbound: { type: 'shipped', verb: 'Shipped' },
  Adjustment: { type: 'adjusted', verb: 'Adjusted' },
  Transfer: { type: 'transfer', verb: 'Transferred' },
};

export function mapMovementToActivity(m: StockMovementDto): ActivityEvent {
  const meta = MOVEMENT_ACTIVITY[m.type];
  const sign = m.quantityDelta > 0 ? '+' : '';
  const parts = [`${sign}${m.quantityDelta} units`, m.warehouseName];
  if (m.referenceNumber) parts.push(m.referenceNumber);
  if (m.performedByName) parts.push(m.performedByName);
  return {
    id: `movement-${m.id}`,
    type: meta.type,
    title: `${meta.verb} · ${m.productName}`,
    detail: parts.join(' · '),
    timestamp: m.createdAt,
    siteId: String(m.warehouseId),
  };
}

/** Summary + flow → dashboard report data (KPI trends, activity, flow chart). */
export function mapReportSnapshot(summary: InventorySummaryDto, flow: readonly StockFlowPointDto[]): ReportSnapshot {
  const closing = flow.map((p) => p.closingStock).slice(-9);
  const unitValue =
    summary.totalStockValue !== null && summary.totalItems > 0 ? summary.totalStockValue / summary.totalItems : 0;

  return {
    activity: summary.recentActivity.slice(0, 5).map(mapMovementToActivity),
    flow: flow.map((p) => ({ label: p.label, inbound: p.inbound, outbound: p.outbound })),
    operations: {
      pendingOrders: summary.pendingPurchaseOrders,
      recentOrders: summary.purchaseOrdersLast30Days,
      shipmentsToday: summary.shipmentsToday,
      trends: {
        items: closing,
        value: closing.map((units) => Math.round(units * unitValue)),
        shipments: summary.shipmentsTrend,
      },
    },
  };
}
