import { InvenTreeCategory, InvenTreePart, InvenTreeStock } from '../models/inventree.models';
import { mapInvenTreeRole } from './auth.mapper';
import { deriveStockStatus, formatSku, mapInvenTreeData, siteIdFromName, unwrapList } from './inventory.mapper';

const part = (overrides: Partial<InvenTreePart>): InvenTreePart => ({
  pk: 1,
  name: 'Widget',
  description: '',
  IPN: null,
  category: 10,
  active: true,
  assembly: false,
  component: true,
  purchaseable: true,
  salable: true,
  trackable: false,
  virtual: false,
  units: null,
  minimum_stock: 0,
  image: null,
  thumbnail: null,
  ...overrides,
});

const stock = (overrides: Partial<InvenTreeStock>): InvenTreeStock => ({
  pk: 100,
  part: 1,
  quantity: 0,
  serial: null,
  batch: null,
  location: null,
  status: 10,
  purchase_price: null,
  updated: null,
  ...overrides,
});

describe('inventory mapper', () => {
  it('derives stock status from quantity and minimum stock', () => {
    expect(deriveStockStatus(0, 10)).toBe('out-of-stock');
    expect(deriveStockStatus(10, 10)).toBe('low-stock');
    expect(deriveStockStatus(11, 10)).toBe('in-stock');
    expect(deriveStockStatus(5, 0)).toBe('in-stock');
  });

  it('uses the IPN as SKU and falls back to a padded part number', () => {
    expect(formatSku({ pk: 7, IPN: ' ABC-1 ' })).toBe('ABC-1');
    expect(formatSku({ pk: 7, IPN: null })).toBe('PRT-00007');
  });

  it('unwraps both paginated and plain list responses', () => {
    expect(unwrapList([1, 2])).toEqual([1, 2]);
    expect(unwrapList({ count: 1, next: null, previous: null, results: [3] })).toEqual([3]);
  });

  it('builds sites from top-level locations and splits stock per site', () => {
    const categories: InvenTreeCategory[] = [
      { pk: 10, name: 'Sensors', description: '', pathstring: 'Sensors', parent: null, level: 0, part_count: 1, structural: false },
    ];
    const result = mapInvenTreeData(
      {
        parts: [part({ minimum_stock: 5, pricing_min: '2.00', pricing_max: '4.00' })],
        categories,
        stock: [
          stock({ pk: 1, quantity: 6, location_detail: { pk: 1, name: 'Bin 1', pathstring: 'São Paulo DC/Aisle 1/Bin 1' } }),
          stock({ pk: 2, quantity: 4, location_detail: { pk: 2, name: 'Shelf', pathstring: 'Austin Hub/Shelf' } }),
        ],
      },
      (path) => path,
    );

    const [item] = result.items;
    expect(item.category).toBe('Sensors');
    expect(item.stock).toBe(10);
    expect(item.unitPrice).toBe(3);
    expect(item.status).toBe('in-stock');
    expect(item.stockBySite).toEqual({ 'sao-paulo-dc': 6, 'austin-hub': 4 });
    expect(item.location).toBe('São Paulo DC');
    expect(result.sites.map((s) => s.id)).toEqual(['sao-paulo-dc', 'austin-hub']);
  });

  it('slugifies site names', () => {
    expect(siteIdFromName('São Paulo DC')).toBe('sao-paulo-dc');
  });
});

describe('InvenTree role mapping', () => {
  const roles = (r: Record<string, ('view' | 'add' | 'change' | 'delete')[]>, superuser = false) => ({
    user: 1,
    username: 'u',
    is_staff: false,
    is_superuser: superuser,
    roles: r,
  });

  it('maps rulesets onto personas', () => {
    expect(mapInvenTreeRole(roles({}, true))).toBe('admin');
    expect(mapInvenTreeRole(roles({ part: ['view', 'delete'] }))).toBe('manager');
    expect(mapInvenTreeRole(roles({ stock: ['view', 'change'] }))).toBe('operator');
    expect(mapInvenTreeRole(roles({ part: ['view'] }))).toBe('viewer');
  });
});
