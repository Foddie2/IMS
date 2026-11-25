-- =============================================================================
-- Demo data (12 electronics products across 5 sites). Safe to re-run.
-- Run after migrations/0001_inventory_schema.sql.
-- =============================================================================

insert into public.sites (id, name, city, map_x, map_y) values
  ('rtm', 'Rotterdam DC',  'Rotterdam, NL', 51.3, 21.2),
  ('aus', 'Austin Hub',    'Austin, US',    22.9, 33.2),
  ('sin', 'Singapore DC',  'Singapore, SG', 78.8, 49.2),
  ('nbo', 'Nairobi Hub',   'Nairobi, KE',   60.2, 50.7),
  ('gru', 'São Paulo DC',  'São Paulo, BR', 37.1, 63.1)
on conflict (id) do nothing;

insert into public.categories (name) values
  ('Compute Modules'), ('Sensors'), ('Storage'), ('Cables & Connectors'),
  ('Networking'), ('Displays'), ('Power'), ('Peripherals')
on conflict (name) do nothing;

insert into public.products (sku, name, description, category_id, unit_price, minimum_stock, barcode, image_url)
select p.sku, p.name, p.description, c.id, p.unit_price, p.minimum_stock, p.barcode, p.image_url
from (values
  ('CMP-ESP32-S3',  'ESP32-S3 Dev Board',          'Dual-core Wi-Fi + BLE microcontroller board, 8 MB PSRAM.', 'Compute Modules',      8.90, 200, '7350012400011', '/images/products/microcontroller.svg'),
  ('CMP-SBC-8G',    'Single-Board Computer 8 GB',  'Quad-core ARM SBC, 8 GB LPDDR4X, dual 4K output.',         'Compute Modules',     80.00, 100, '7350012400028', '/images/products/sbc.svg'),
  ('SNS-BME280',    'BME280 Environmental Sensor', 'Temperature, humidity and pressure sensor breakout.',      'Sensors',              4.75, 150, '7350012400035', '/images/products/sensor.svg'),
  ('STO-NVME-1T',   'NVMe SSD 1 TB Gen4',          'M.2 2280 PCIe 4.0 solid-state drive, 7,000 MB/s read.',    'Storage',            109.00,  40, '7350012400042', '/images/products/ssd.svg'),
  ('CBL-USBC-1M',   'USB-C to USB-C Cable 1 m',    '100 W PD, USB 3.2 Gen 2 braided cable.',                   'Cables & Connectors',  3.20, 300, '7350012400059', '/images/products/cable.svg'),
  ('NET-AX3000',    'Wi-Fi 6 Dual-Band Router',    'AX3000 router with 4× gigabit LAN and WPA3.',              'Networking',          79.99,  40, '7350012400066', '/images/products/router.svg'),
  ('DSP-7IPS-TCH',  '7" IPS Touch Display',        '1024×600 capacitive touchscreen with HDMI input.',         'Displays',            42.50,  50, '7350012400073', '/images/products/display.svg'),
  ('PWR-18650-35',  '18650 Li-ion Cell 3500 mAh',  'High-capacity rechargeable cell, 10 A continuous.',        'Power',                5.40, 400, '7350012400080', '/images/products/battery.svg'),
  ('PWR-PSU-12V5A', '12 V 5 A Switching PSU',      'Enclosed 60 W power supply, universal AC input.',          'Power',               18.60,  60, '7350012400097', '/images/products/psu.svg'),
  ('PER-KB-WLM',    'Wireless Mechanical Keyboard','Low-profile tactile switches, Bluetooth + 2.4 GHz.',       'Peripherals',         99.99,  30, '7350012400103', '/images/products/keyboard.svg'),
  ('SNS-CAM-5MP',   '5 MP Camera Module',          'OV5647 sensor, 15-pin MIPI CSI ribbon included.',          'Sensors',             12.30,  25, '7350012400110', '/images/products/camera.svg'),
  ('CBL-CAT6-2M',   'Cat6 Patch Cable 2 m',        'Snagless RJ45, 550 MHz, LSZH jacket.',                     'Cables & Connectors',  2.10, 100, '7350012400127', '/images/products/cable.svg')
) as p(sku, name, description, category, unit_price, minimum_stock, barcode, image_url)
join public.categories c on c.name = p.category
on conflict (sku) do nothing;

-- Seed quantities without flooding the activity feed.
alter table public.stock_levels disable trigger stock_levels_log_change;

insert into public.stock_levels (product_id, site_id, quantity)
select pr.id, s.site_id, s.quantity
from (values
  ('CMP-ESP32-S3', 'rtm', 744), ('CMP-ESP32-S3', 'aus', 310), ('CMP-ESP32-S3', 'sin', 186),
  ('CMP-SBC-8G', 'aus', 53),    ('CMP-SBC-8G', 'sin', 21),    ('CMP-SBC-8G', 'nbo', 12),
  ('SNS-BME280', 'sin', 386),   ('SNS-BME280', 'nbo', 160),   ('SNS-BME280', 'gru', 96),
  ('STO-NVME-1T', 'rtm', 0),
  ('CBL-USBC-1M', 'nbo', 588),  ('CBL-USBC-1M', 'gru', 245),  ('CBL-USBC-1M', 'rtm', 147),
  ('NET-AX3000', 'aus', 15),    ('NET-AX3000', 'sin', 6),     ('NET-AX3000', 'nbo', 3),
  ('DSP-7IPS-TCH', 'sin', 80),  ('DSP-7IPS-TCH', 'nbo', 33),  ('DSP-7IPS-TCH', 'gru', 19),
  ('PWR-18650-35', 'gru', 672), ('PWR-18650-35', 'rtm', 280), ('PWR-18650-35', 'aus', 168),
  ('PWR-PSU-12V5A', 'rtm', 0),
  ('PER-KB-WLM', 'aus', 36),    ('PER-KB-WLM', 'sin', 14),    ('PER-KB-WLM', 'nbo', 8),
  ('SNS-CAM-5MP', 'sin', 12),   ('SNS-CAM-5MP', 'nbo', 4),    ('SNS-CAM-5MP', 'gru', 2),
  ('CBL-CAT6-2M', 'nbo', 36),   ('CBL-CAT6-2M', 'gru', 14),   ('CBL-CAT6-2M', 'rtm', 8)
) as s(sku, site_id, quantity)
join public.products pr on pr.sku = s.sku
on conflict (product_id, site_id) do nothing;

alter table public.stock_levels enable trigger stock_levels_log_change;

-- A few historical events so the activity feed isn't empty on day one.
insert into public.activity_events (type, title, detail, site_id, created_at)
select v.type::public.activity_type, v.title, v.detail, v.site_id, now() - v.age
from (values
  ('received', 'Purchase order PO-2291 received', '1,200 × USB-C to USB-C Cable 1 m · Nairobi Hub', 'nbo', interval '25 minutes'),
  ('alert',    'Out of stock: NVMe SSD 1 TB Gen4', 'Reorder suggested · 40 units minimum',          'rtm', interval '2 hours'),
  ('shipped',  'Shipment SH-7734 dispatched',      '312 parcels via DHL Express · Rotterdam DC',     'rtm', interval '3 hours'),
  ('order',    'Sales order SO-5180 created',      '24 × Wi-Fi 6 Dual-Band Router · Retail channel', 'aus', interval '17 hours'),
  ('adjusted', 'Stock count adjusted',             'BME280 Environmental Sensor −8 · cycle count',   'sin', interval '20 hours')
) as v(type, title, detail, site_id, age)
where not exists (select 1 from public.activity_events);
