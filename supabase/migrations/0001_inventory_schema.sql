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
