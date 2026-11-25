-- =============================================================================
-- IMS · FRESH SETUP  (generated: reset.sql + migrations/0001_inventory_schema.sql + seed.sql)
-- Paste the whole file into Supabase → SQL Editor → Run. Then run `npm run setup:users`.
-- ⚠ Deletes all existing IMS inventory data. Supabase Auth logins are kept.
-- =============================================================================

-- =============================================================================
-- IMS · RESET – removes every IMS table, function, trigger and type.
-- Supabase Auth users (your logins) are NOT deleted; `npm run setup:users`
-- re-creates their profiles/roles and can reset passwords.
-- ⚠ All inventory data in these tables is permanently deleted.
-- =============================================================================
drop trigger if exists on_auth_user_created on auth.users;

-- Dropping the tables also removes them from the Realtime publication.
drop table if exists
  public.activity_events,
  public.stock_levels,
  public.products,
  public.categories,
  public.sites,
  public.profiles
  cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.log_stock_change() cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.can_access_site(text) cascade;
drop function if exists public.current_app_role() cascade;

drop type if exists public.activity_type cascade;
drop type if exists public.app_role cascade;


-- =============================================================================
-- IMS (Inventory Management System) · schema for Supabase
--
-- Run once in Supabase → SQL Editor (paste the whole file, click "Run").
-- Then run supabase/seed.sql for demo data, and supabase/bootstrap_admin.sql
-- to promote your own account to admin.
--
-- Security model
--   * Every table has row-level security (RLS). Nothing is readable without signing in.
--   * profiles.role         → admin | manager | operator | viewer
--   * profiles.site_ids     → sites an operator may access ('*' = every site)
--   * admin/manager/viewer see every site; operators only their assigned sites.
--   * Only admins can change roles or site access; users cannot promote themselves.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'manager', 'operator', 'viewer');
create type public.activity_type as enum ('received', 'shipped', 'adjusted', 'alert', 'order');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.sites (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  name       text not null,
  city       text not null default '',
  -- Pin position on the dashboard map, in percent of width/height.
  map_x      numeric(5, 2) not null default 50 check (map_x between 0 and 100),
  map_y      numeric(5, 2) not null default 50 check (map_y between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.categories (
  id   bigint generated always as identity primary key,
  name text not null unique
);

create table public.products (
  id            bigint generated always as identity primary key,
  sku           text not null unique,
  name          text not null,
  description   text not null default '',
  category_id   bigint references public.categories (id) on delete set null,
  unit_price    numeric(12, 2) not null default 0 check (unit_price >= 0),
  units         text not null default 'pcs',
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  barcode       text,
  image_url     text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index products_category_id_idx on public.products (category_id);

-- Quantity on hand per product per site.
create table public.stock_levels (
  product_id bigint not null references public.products (id) on delete cascade,
  site_id    text not null references public.sites (id) on delete cascade,
  quantity   integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, site_id)
);
create index stock_levels_site_id_idx on public.stock_levels (site_id);

create table public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  type       public.activity_type not null,
  title      text not null,
  detail     text not null default '',
  site_id    text references public.sites (id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_events_created_at_idx on public.activity_events (created_at desc);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  title      text not null default '',
  -- Least privilege by default: new users see nothing until an admin assigns sites/role.
  role       public.app_role not null default 'operator',
  site_ids   text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER so policies can read profiles without recursion)
-- ---------------------------------------------------------------------------
create function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.can_access_site(target_site text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'manager', 'viewer')
        or '*' = any (p.site_ids)
        or target_site = any (p.site_ids)
      )
  )
$$;

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.can_access_site(text) from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.can_access_site(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.sites           enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.stock_levels    enable row level security;
alter table public.activity_events enable row level security;
alter table public.profiles        enable row level security;

-- sites
create policy "sites: read accessible" on public.sites
  for select to authenticated using (public.can_access_site(id));
create policy "sites: admins manage" on public.sites
  for all to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- categories (catalogue is shared by all signed-in users)
create policy "categories: read" on public.categories
  for select to authenticated using (true);
create policy "categories: admins and managers manage" on public.categories
  for all to authenticated
  using (public.current_app_role() in ('admin', 'manager'))
  with check (public.current_app_role() in ('admin', 'manager'));

-- products
create policy "products: read" on public.products
  for select to authenticated using (true);
create policy "products: admins and managers manage" on public.products
  for all to authenticated
  using (public.current_app_role() in ('admin', 'manager'))
  with check (public.current_app_role() in ('admin', 'manager'));

-- stock_levels (site-scoped)
create policy "stock: read accessible sites" on public.stock_levels
  for select to authenticated using (public.can_access_site(site_id));
create policy "stock: staff write accessible sites" on public.stock_levels
  for all to authenticated
  using (public.current_app_role() in ('admin', 'manager', 'operator') and public.can_access_site(site_id))
  with check (public.current_app_role() in ('admin', 'manager', 'operator') and public.can_access_site(site_id));

-- activity_events (site-scoped; events without a site are company-wide)
create policy "activity: read accessible" on public.activity_events
  for select to authenticated
  using (site_id is null or public.can_access_site(site_id));
create policy "activity: staff insert" on public.activity_events
  for insert to authenticated
  with check (
    public.current_app_role() in ('admin', 'manager', 'operator')
    and (site_id is null or public.can_access_site(site_id))
  );

-- profiles: read your own (admins read all); only admins change roles/site access
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_app_role() = 'admin');
create policy "profiles: admins update" on public.profiles
  for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

create trigger stock_levels_touch_updated_at
  before update on public.stock_levels
  for each row execute function public.touch_updated_at();

-- Every new auth user gets a profile (least privilege; an admin assigns role/sites).
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before this migration ran.
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- Stock changes write to the activity feed automatically (shown live on the dashboard).
create function public.log_stock_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  product_name text;
  site_name    text;
  delta        integer;
  event_type   public.activity_type;
begin
  delta := new.quantity - case when tg_op = 'UPDATE' then old.quantity else 0 end;
  if delta = 0 then
    return new;
  end if;

  select name into product_name from public.products where id = new.product_id;
  select name into site_name from public.sites where id = new.site_id;

  event_type := case
    when new.quantity = 0 then 'alert'
    when delta > 0 then 'received'
    else 'adjusted'
  end;

  insert into public.activity_events (type, title, detail, site_id)
  values (
    event_type,
    case event_type
      when 'alert' then 'Out of stock: ' || product_name
      when 'received' then 'Stock received · ' || product_name
      else 'Stock adjusted · ' || product_name
    end,
    format('%s%s units · now %s · %s', case when delta > 0 then '+' else '' end, delta, new.quantity, site_name),
    new.site_id
  );
  return new;
end
$$;

create trigger stock_levels_log_change
  after insert or update of quantity on public.stock_levels
  for each row execute function public.log_stock_change();

-- ---------------------------------------------------------------------------
-- Realtime: the dashboard refreshes when these tables change (RLS still applies).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.stock_levels, public.products, public.activity_events;


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
