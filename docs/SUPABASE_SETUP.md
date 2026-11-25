# Connecting the dashboard to Supabase

Until Supabase is configured the app runs in **demo mode**: sample data, no login, and a role switcher in the account menu.

## 1. Create the database (≈2 min)

In your Supabase project → **SQL Editor** → *New query*, paste and **Run** each file, in order:

1. `supabase/migrations/0001_inventory_schema.sql`: tables, row-level security, triggers, Realtime
2. `supabase/seed.sql`: 5 sites, 8 categories, 12 demo products with stock (optional, safe to re-run)

## 2. Create your user and make it admin

1. **Authentication → Users → Add user → Create new user** (email + password, tick *Auto Confirm User*).
2. Open `supabase/bootstrap_admin.sql`, replace `you@example.com` with that email, and **Run** it.
3. Recommended: **Authentication → Sign In / Providers → Email**, turn **off** "Allow new users to sign up",
   so only accounts you create can sign in.

New users start as *operator* with **no sites** (they see nothing) until an admin assigns them.
Examples are at the bottom of `bootstrap_admin.sql`.

| Role       | Sees                      | Can change stock | Sees cost/value | Settings |
|------------|---------------------------|------------------|-----------------|----------|
| `admin`    | all sites                 | ✔                | ✔               | ✔        |
| `manager`  | all sites                 | ✔                | ✔               |          |
| `operator` | only `site_ids`           | ✔ (own sites)    |                 |          |
| `viewer`   | all sites (read-only)     |                  | ✔               |          |

## 3. Point the app at your project

Copy `.env.example` to `.env` (git-ignored) and fill in **Project Settings → API**:

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`npm start` / `npm run build` / `npm test` generate `src/environments/supabase.env.ts` (also git-ignored)
from it automatically. In CI or hosting, set the same two names as environment variables.
Restart `npm start` after changing `.env`.

The publishable key is designed to be public: it ends up in the browser bundle no matter where it is stored,
and row-level security protects the data. `.env` keeps it out of git. **Never** use the `secret` / `service_role` key;
the build refuses it.

## 4. Verify

```bash
# set TEST_EMAIL / TEST_PASSWORD in .env first
npm run verify:supabase              # schema, RLS, sign-in, data, Realtime
npm run verify:supabase -- --write   # also +1/-1 on one stock row to test writes, trigger & Realtime
```

Then `npm start`, open http://localhost:4200, and sign in. The header shows **Live · Supabase · Realtime**.
Change a quantity in **Table Editor → stock_levels**: the dashboard and *Recent Activity* update within a second.

## Data model

| Table             | Purpose                                                            |
|-------------------|--------------------------------------------------------------------|
| `sites`           | Warehouses/stores; `map_x`/`map_y` = pin position (0–100 %)        |
| `categories`      | Product categories                                                 |
| `products`        | SKU, name, price, `minimum_stock` (drives Low Stock), image, barcode |
| `stock_levels`    | Quantity per product **per site** (multi-site source of truth)     |
| `activity_events` | Feed; stock changes are logged automatically by a trigger          |
| `profiles`        | One per auth user: `role`, `site_ids` (`{*}` = all sites)          |

## Known limits

- Pending orders, shipments today, KPI trend lines and the inventory-flow chart still use sample series (no orders tables yet).
- Cost data is hidden from operators in the UI, but row-level security is per row, not per column.
  To hide `unit_price` from operators at the database level, expose products through a view without that column.
