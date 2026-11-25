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
