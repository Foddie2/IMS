import {
  ActivityEvent,
  FlowPoint,
  InventoryItem,
  InventorySnapshot,
  OperationsSnapshot,
  Site,
} from '../models/inventory.models';
import { deriveStockStatus } from '../utils/inventory.mapper';

type SampleItem = Omit<InventoryItem, 'status' | 'stockBySite'>;

const SAMPLE_ITEMS: readonly SampleItem[] = [
  {
    id: 1001,
    name: 'ESP32-S3 Dev Board',
    description: 'Dual-core Wi-Fi + BLE microcontroller board, 8 MB PSRAM.',
    sku: 'CMP-ESP32-S3',
    category: 'Compute Modules',
    stock: 1240,
    minimumStock: 200,
    unitPrice: 8.9,
    units: 'pcs',
    barcode: '7350012400011',
    imageUrl: '/images/products/microcontroller.svg',
    location: 'Rotterdam DC',
  },
  {
    id: 1002,
    name: 'Single-Board Computer 8 GB',
    description: 'Quad-core ARM SBC, 8 GB LPDDR4X, dual 4K output.',
    sku: 'CMP-SBC-8G',
    category: 'Compute Modules',
    stock: 86,
    minimumStock: 100,
    unitPrice: 80,
    units: 'pcs',
    barcode: '7350012400028',
    imageUrl: '/images/products/sbc.svg',
    location: 'Austin Hub',
  },
  {
    id: 1003,
    name: 'BME280 Environmental Sensor',
    description: 'Temperature, humidity and pressure sensor breakout (I²C/SPI).',
    sku: 'SNS-BME280',
    category: 'Sensors',
    stock: 642,
    minimumStock: 150,
    unitPrice: 4.75,
    units: 'pcs',
    barcode: '7350012400035',
    imageUrl: '/images/products/sensor.svg',
    location: 'Singapore DC',
  },
  {
    id: 1004,
    name: 'NVMe SSD 1 TB Gen4',
    description: 'M.2 2280 PCIe 4.0 solid-state drive, 7,000 MB/s read.',
    sku: 'STO-NVME-1T',
    category: 'Storage',
    stock: 0,
    minimumStock: 40,
    unitPrice: 109,
    units: 'pcs',
    barcode: '7350012400042',
    imageUrl: '/images/products/ssd.svg',
    location: 'Rotterdam DC',
  },
  {
    id: 1005,
    name: 'USB-C to USB-C Cable 1 m',
    description: '100 W PD, USB 3.2 Gen 2 braided cable.',
    sku: 'CBL-USBC-1M',
    category: 'Cables & Connectors',
    stock: 980,
    minimumStock: 300,
    unitPrice: 3.2,
    units: 'pcs',
    barcode: '7350012400059',
    imageUrl: '/images/products/cable.svg',
    location: 'Nairobi Hub',
  },
  {
    id: 1006,
    name: 'Wi-Fi 6 Dual-Band Router',
    description: 'AX3000 router with 4× gigabit LAN and WPA3.',
    sku: 'NET-AX3000',
    category: 'Networking',
    stock: 24,
    minimumStock: 40,
    unitPrice: 79.99,
    units: 'pcs',
    barcode: '7350012400066',
    imageUrl: '/images/products/router.svg',
    location: 'Austin Hub',
  },
  {
    id: 1007,
    name: '7" IPS Touch Display',
    description: '1024×600 capacitive touchscreen with HDMI input.',
    sku: 'DSP-7IPS-TCH',
    category: 'Displays',
    stock: 132,
    minimumStock: 50,
    unitPrice: 42.5,
    units: 'pcs',
    barcode: '7350012400073',
    imageUrl: '/images/products/display.svg',
    location: 'Singapore DC',
  },
  {
    id: 1008,
    name: '18650 Li-ion Cell 3500 mAh',
    description: 'High-capacity rechargeable cell, 10 A continuous discharge.',
    sku: 'PWR-18650-35',
    category: 'Power',
    stock: 1120,
    minimumStock: 400,
    unitPrice: 5.4,
    units: 'pcs',
    barcode: '7350012400080',
    imageUrl: '/images/products/battery.svg',
    location: 'São Paulo DC',
  },
  {
    id: 1009,
    name: '12 V 5 A Switching PSU',
    description: 'Enclosed 60 W power supply, universal AC input.',
    sku: 'PWR-PSU-12V5A',
    category: 'Power',
    stock: 0,
    minimumStock: 60,
    unitPrice: 18.6,
    units: 'pcs',
    barcode: '7350012400097',
    imageUrl: '/images/products/psu.svg',
    location: 'Rotterdam DC',
  },
  {
    id: 1010,
    name: 'Wireless Mechanical Keyboard',
    description: 'Low-profile tactile switches, Bluetooth + 2.4 GHz.',
    sku: 'PER-KB-WLM',
    category: 'Peripherals',
    stock: 58,
    minimumStock: 30,
    unitPrice: 99.99,
    units: 'pcs',
    barcode: '7350012400103',
    imageUrl: '/images/products/keyboard.svg',
    location: 'Austin Hub',
  },
  {
    id: 1011,
    name: '5 MP Camera Module',
    description: 'OV5647 sensor, 15-pin MIPI CSI ribbon included.',
    sku: 'SNS-CAM-5MP',
    category: 'Sensors',
    stock: 18,
    minimumStock: 25,
    unitPrice: 12.3,
    units: 'pcs',
    barcode: '7350012400110',
    imageUrl: '/images/products/camera.svg',
    location: 'Singapore DC',
  },
  {
    id: 1012,
    name: 'Cat6 Patch Cable 2 m',
    description: 'Snagless RJ45, 550 MHz, LSZH jacket.',
    sku: 'CBL-CAT6-2M',
    category: 'Cables & Connectors',
    stock: 58,
    minimumStock: 100,
    unitPrice: 2.1,
    units: 'pcs',
    barcode: '7350012400127',
    imageUrl: '/images/products/cable.svg',
    location: 'Nairobi Hub',
  },
];

/** Pins placed on an equirectangular projection: x = (lon+180)/360, y = (90-lat)/180. */
export const SAMPLE_SITES: readonly Site[] = [
  { id: 'rtm', name: 'Rotterdam DC', city: 'Rotterdam, NL', x: 51.3, y: 21.2 },
  { id: 'aus', name: 'Austin Hub', city: 'Austin, US', x: 22.9, y: 33.2 },
  { id: 'sin', name: 'Singapore DC', city: 'Singapore, SG', x: 78.8, y: 49.2 },
  { id: 'nbo', name: 'Nairobi Hub', city: 'Nairobi, KE', x: 60.2, y: 50.7 },
  { id: 'gru', name: 'São Paulo DC', city: 'São Paulo, BR', x: 37.1, y: 63.1 },
];

/** Primary site keeps the majority; the next two sites (in list order) hold the rest. */
const SITE_SPLIT = [0.6, 0.25, 0.15] as const;

function splitAcrossSites(item: SampleItem): Record<string, number> {
  if (item.stock <= 0) return {};
  const primary = Math.max(0, SAMPLE_SITES.findIndex((s) => s.name === item.location));
  const ids = SITE_SPLIT.map((_, i) => SAMPLE_SITES[(primary + i) % SAMPLE_SITES.length].id);
  const allocation: Record<string, number> = {};
  let allocated = 0;
  SITE_SPLIT.forEach((share, i) => {
    if (i === 0) return;
    const units = Math.floor(item.stock * share);
    allocation[ids[i]] = units;
    allocated += units;
  });
  allocation[ids[0]] = item.stock - allocated;
  return allocation;
}

const SAMPLE_ACTIVITY: readonly ActivityEvent[] = [
  {
    id: 'evt-1',
    type: 'received',
    title: 'Purchase order PO-2291 received',
    detail: '1,200 × USB-C to USB-C Cable 1 m · Nairobi Hub',
    timestamp: '2026-11-24T09:42:00Z',
    siteId: 'nbo',
  },
  {
    id: 'evt-2',
    type: 'alert',
    title: 'Out of stock: NVMe SSD 1 TB Gen4',
    detail: 'Reorder suggested · 40 units minimum',
    timestamp: '2026-11-24T08:15:00Z',
    siteId: 'rtm',
  },
  {
    id: 'evt-3',
    type: 'shipped',
    title: 'Shipment SH-7734 dispatched',
    detail: '312 parcels via DHL Express · Rotterdam DC',
    timestamp: '2026-11-24T07:30:00Z',
    siteId: 'rtm',
  },
  {
    id: 'evt-4',
    type: 'order',
    title: 'Sales order SO-5180 created',
    detail: '24 × Wi-Fi 6 Dual-Band Router · Retail channel',
    timestamp: '2026-11-23T17:05:00Z',
    siteId: 'aus',
  },
  {
    id: 'evt-5',
    type: 'adjusted',
    title: 'Stock count adjusted',
    detail: 'BME280 Environmental Sensor −8 · cycle count',
    timestamp: '2026-11-23T14:20:00Z',
    siteId: 'sin',
  },
];

const SAMPLE_FLOW: readonly FlowPoint[] = [
  { label: 'Dec', inbound: 3100, sales: 2650 },
  { label: 'Jan', inbound: 2800, sales: 2400 },
  { label: 'Feb', inbound: 3350, sales: 2900 },
  { label: 'Mar', inbound: 3900, sales: 3150 },
  { label: 'Apr', inbound: 3600, sales: 3400 },
  { label: 'May', inbound: 4200, sales: 3650 },
  { label: 'Jun', inbound: 4500, sales: 3900 },
  { label: 'Jul', inbound: 4150, sales: 4250 },
  { label: 'Aug', inbound: 4800, sales: 4100 },
  { label: 'Sep', inbound: 5200, sales: 4550 },
  { label: 'Oct', inbound: 4950, sales: 4800 },
  { label: 'Nov', inbound: 5600, sales: 5050 },
];

const SAMPLE_OPERATIONS: OperationsSnapshot = {
  pendingOrders: 128,
  pendingOrdersCapacity: 200,
  shipmentsToday: 312,
  trends: {
    items: [3620, 3810, 3760, 3990, 4080, 3950, 4210, 4180, 4358],
    value: [61, 64, 63, 68, 70, 69, 74, 76, 78],
    shipments: [240, 262, 251, 280, 274, 296, 288, 305, 312],
  },
};

/** Sample operational data that the parts/stock endpoints do not provide. */
export function sampleOperationalData(): Pick<InventorySnapshot, 'flow' | 'operations'> {
  return { flow: [...SAMPLE_FLOW], operations: SAMPLE_OPERATIONS };
}

export function buildSampleSnapshot(notice: string): InventorySnapshot {
  const items = SAMPLE_ITEMS.map((item) => ({
    ...item,
    status: deriveStockStatus(item.stock, item.minimumStock),
    stockBySite: splitAcrossSites(item),
  }));
  return {
    source: 'sample',
    notice,
    syncedAt: null,
    items,
    categories: [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b)),
    sites: [...SAMPLE_SITES],
    activity: [...SAMPLE_ACTIVITY],
    ...sampleOperationalData(),
  };
}
