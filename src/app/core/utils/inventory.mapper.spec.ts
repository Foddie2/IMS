import { ProductRow } from '../models/supabase.models';
import { initialsOf, mapProfile } from './auth.mapper';
import { deriveStockStatus, mapSupabaseData } from './inventory.mapper';

const product = (overrides: Partial<ProductRow>): ProductRow => ({
  id: 1,
  sku: 'SNS-BME280',
  name: 'BME280 Environmental Sensor',
  description: '',
  unit_price: '4.75',
  units: 'pcs',
  minimum_stock: 150,
  barcode: null,
  image_url: null,
  category: { name: 'Sensors' },
  ...overrides,
});

describe('inventory mapper', () => {
  it('derives stock status from quantity and minimum stock', () => {
    expect(deriveStockStatus(0, 10)).toBe('out-of-stock');
    expect(deriveStockStatus(10, 10)).toBe('low-stock');
    expect(deriveStockStatus(11, 10)).toBe('in-stock');
    expect(deriveStockStatus(5, 0)).toBe('in-stock');
  });

  it('maps Supabase rows into items with per-site stock', () => {
    const result = mapSupabaseData({
      sites: [
        { id: 'rtm', name: 'Rotterdam DC', city: 'Rotterdam, NL', map_x: '51.30', map_y: 21.2 },
        { id: 'nbo', name: 'Nairobi Hub', city: 'Nairobi, KE', map_x: 60.2, map_y: 50.7 },
      ],
      categories: [{ id: 1, name: 'Sensors' }, { id: 2, name: 'Storage' }],
      products: [product({}), product({ id: 2, sku: 'STO-1', name: 'SSD', category: null, barcode: 'B-2' })],
      stock: [
        { product_id: 1, site_id: 'rtm', quantity: 100, updated_at: '' },
        { product_id: 1, site_id: 'nbo', quantity: 300, updated_at: '' },
      ],
      activity: [
        { id: 'e1', type: 'alert', title: 'Out of stock', detail: '', site_id: null, created_at: '2026-11-24T10:00:00Z' },
      ],
    });

    const [sensor, ssd] = result.items;
    expect(sensor.stock).toBe(400);
    expect(sensor.stockBySite).toEqual({ rtm: 100, nbo: 300 });
    expect(sensor.location).toBe('Nairobi Hub');
    expect(sensor.unitPrice).toBe(4.75);
    expect(sensor.status).toBe('in-stock');
    expect(sensor.barcode).toBe('SNS-BME280');

    expect(ssd.category).toBe('Uncategorized');
    expect(ssd.status).toBe('out-of-stock');
    expect(ssd.barcode).toBe('B-2');

    expect(result.sites[0]).toEqual({ id: 'rtm', name: 'Rotterdam DC', city: 'Rotterdam, NL', x: 51.3, y: 21.2 });
    expect(result.categories).toEqual(['Sensors', 'Storage', 'Uncategorized']);
    expect(result.activity[0]).toMatchObject({ id: 'e1', timestamp: '2026-11-24T10:00:00Z', siteId: undefined });
  });
});

describe('auth mapper', () => {
  it('maps a profile row to the app user', () => {
    const user = mapProfile(
      { id: 'u1', full_name: '', title: '', role: 'operator', site_ids: ['rtm'] },
      'dana@example.com',
    );
    expect(user).toEqual({ id: 'u1', name: 'dana@example.com', title: 'Warehouse Operator', role: 'operator', siteIds: ['rtm'] });
  });

  it('builds initials from names and emails', () => {
    expect(initialsOf('Alex Morgan')).toBe('AM');
    expect(initialsOf('dana@example.com')).toBe('DE');
  });
});
