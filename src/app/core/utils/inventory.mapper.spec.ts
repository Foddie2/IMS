import { InventoryItemDto, InventorySummaryDto, StockMovementDto, UserDto } from '../models/api.models';
import { initialsOf, mapUser, tokenExpiry } from './auth.mapper';
import { deriveStockStatus, mapInventorySnapshot, mapMovementToActivity, mapReportSnapshot } from './inventory.mapper';

const item = (overrides: Partial<InventoryItemDto> = {}): InventoryItemDto => ({
  productId: 1,
  sku: 'SNS-BME280',
  name: 'BME280 Environmental Sensor',
  description: '',
  categoryId: 2,
  categoryName: 'Sensors',
  unitPrice: 4.75,
  units: 'pcs',
  minimumStock: 150,
  barcode: null,
  imageUrl: null,
  totalQuantity: 400,
  stockStatus: 'InStock',
  warehouses: [
    { warehouseId: 1, warehouseCode: 'RTM', warehouseName: 'Rotterdam DC', quantity: 100, updatedAt: '' },
    { warehouseId: 4, warehouseCode: 'NBO', warehouseName: 'Nairobi Hub', quantity: 300, updatedAt: '' },
  ],
  ...overrides,
});

const movement = (overrides: Partial<StockMovementDto> = {}): StockMovementDto => ({
  id: 7,
  productId: 1,
  productSku: 'SNS-BME280',
  productName: 'BME280 Environmental Sensor',
  warehouseId: 4,
  warehouseCode: 'NBO',
  warehouseName: 'Nairobi Hub',
  type: 'Outbound',
  quantityDelta: -12,
  referenceNumber: 'SO-1',
  notes: null,
  performedByUserId: 3,
  performedByName: 'Daniel Okoye',
  createdAt: '2026-11-25T08:00:00Z',
  ...overrides,
});

describe('inventory mapper', () => {
  it('derives stock status with the same rule as the API', () => {
    expect(deriveStockStatus(0, 10)).toBe('out-of-stock');
    expect(deriveStockStatus(10, 10)).toBe('low-stock');
    expect(deriveStockStatus(11, 10)).toBe('in-stock');
    expect(deriveStockStatus(5, 0)).toBe('in-stock');
  });

  it('maps API inventory into dashboard items keyed by warehouse id', () => {
    const snapshot = mapInventorySnapshot(
      [
        { id: 1, code: 'RTM', name: 'Rotterdam DC', city: 'Rotterdam', mapX: 51.3, mapY: 21.2, isActive: true },
        { id: 4, code: 'NBO', name: 'Nairobi Hub', city: 'Nairobi', mapX: 60.2, mapY: 50.7, isActive: true },
      ],
      [item(), item({ productId: 2, sku: 'X', name: 'Unpriced', categoryName: null, unitPrice: null, totalQuantity: 0, stockStatus: 'OutOfStock', warehouses: [] })],
      '2026-11-25T08:00:00Z',
    );

    const [sensor, unpriced] = snapshot.items;
    expect(sensor.stockBySite).toEqual({ '1': 100, '4': 300 });
    expect(sensor.location).toBe('Nairobi Hub');
    expect(sensor.status).toBe('in-stock');
    expect(sensor.barcode).toBe('SNS-BME280');
    expect(unpriced.unitPrice).toBe(0);
    expect(unpriced.category).toBe('Uncategorized');
    expect(unpriced.status).toBe('out-of-stock');
    expect(snapshot.sites.map((s) => s.id)).toEqual(['1', '4']);
    expect(snapshot.categories).toEqual(['Sensors', 'Uncategorized']);
  });

  it('turns movements into activity events', () => {
    expect(mapMovementToActivity(movement())).toMatchObject({
      type: 'shipped',
      title: 'Shipped · BME280 Environmental Sensor',
      detail: '-12 units · Nairobi Hub · SO-1 · Daniel Okoye',
      siteId: '4',
    });
    expect(mapMovementToActivity(movement({ type: 'Inbound', quantityDelta: 40, referenceNumber: null })).detail).toBe(
      '+40 units · Nairobi Hub · Daniel Okoye',
    );
  });

  it('builds KPI trends and flow from the report endpoints', () => {
    const summary = {
      totalItems: 1000,
      totalStockValue: 5000,
      pendingPurchaseOrders: 3,
      purchaseOrdersLast30Days: 4,
      shipmentsToday: 2,
      shipmentsTrend: [1, 2],
      recentActivity: [movement()],
    } as InventorySummaryDto;
    const report = mapReportSnapshot(summary, [
      { year: 2026, month: 10, label: 'Oct', inbound: 10, outbound: 5, closingStock: 900 },
      { year: 2026, month: 11, label: 'Nov', inbound: 20, outbound: 8, closingStock: 1000 },
    ]);

    expect(report.flow).toEqual([
      { label: 'Oct', inbound: 10, outbound: 5 },
      { label: 'Nov', inbound: 20, outbound: 8 },
    ]);
    expect(report.operations.trends.items).toEqual([900, 1000]);
    expect(report.operations.trends.value).toEqual([4500, 5000]);
    expect(report.operations.pendingOrders).toBe(3);
    expect(report.activity).toHaveLength(1);
  });
});

describe('auth mapper', () => {
  const user = (overrides: Partial<UserDto> = {}): UserDto => ({
    id: 3,
    fullName: 'Daniel Okoye',
    email: 'operator@ims.com',
    role: 'User',
    assignedWarehouseIds: [1, 4],
    ...overrides,
  });

  it('limits Users to their warehouses and gives Admins all', () => {
    expect(mapUser(user()).siteIds).toEqual(['1', '4']);
    expect(mapUser(user({ role: 'Admin', assignedWarehouseIds: [] })).siteIds).toEqual(['*']);
    expect(mapUser(user({ role: 'SuperAdmin' })).title).toBe('Super Admin');
  });

  it('reads the JWT expiry and builds initials', () => {
    const payload = btoa(JSON.stringify({ exp: 2_000_000_000 })).replace(/=+$/, '');
    expect(tokenExpiry(`header.${payload}.signature`)).toBe(2_000_000_000_000);
    expect(tokenExpiry('not-a-jwt')).toBeNull();
    expect(initialsOf('Alex Morgan')).toBe('AM');
  });
});
