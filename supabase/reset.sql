-- =============================================================================
-- IMS · RESET – removes the OLD browser-facing IMS tables from the public schema.
-- The IMS API (backend/) now owns the database and uses its own private `ims` schema;
-- run this once so the old public tables are no longer exposed. Supabase Auth users are not touched.
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
