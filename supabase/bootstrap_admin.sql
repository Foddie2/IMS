-- =============================================================================
-- Make yourself admin. Run AFTER you have created your user
-- (Supabase → Authentication → Users → "Add user", or sign up once).
-- Replace the email below, then Run.
-- =============================================================================
update public.profiles
set role = 'admin',
    site_ids = '{*}',
    full_name = coalesce(nullif(full_name, ''), 'Administrator'),
    title = 'Administrator'
where id = (select id from auth.users where email = 'you@example.com');

-- Examples for other users:
--   Operator limited to Rotterdam + Nairobi:
--     update public.profiles set role = 'operator', site_ids = '{rtm,nbo}', title = 'Warehouse Operator'
--     where id = (select id from auth.users where email = 'operator@example.com');
--   Read-only auditor (all sites):
--     update public.profiles set role = 'viewer', site_ids = '{*}', title = 'Auditor'
--     where id = (select id from auth.users where email = 'auditor@example.com');

-- Check the result:
select u.email, p.role, p.site_ids, p.title
from public.profiles p join auth.users u on u.id = p.id
order by u.email;
