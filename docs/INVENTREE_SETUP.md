# Connecting the dashboard to InvenTree

The dashboard reads parts, categories and stock from InvenTree and re-syncs every 60 seconds.
Until it is connected it runs on built-in sample data (amber **Sample data** badge; hover it for the reason).

## How it connects

```
Browser ──GET /inventree/api/...──▶ Dashboard server (src/server.ts) ──Token auth──▶ InvenTree
```

The browser never sees the API token: the dashboard's own Node server adds it.
No CORS changes are needed on InvenTree. The proxy forwards **GET requests only** to `/api/*` and `/media/*`.

## 1. Get an InvenTree server

- **To try it out:** the public demo at `https://demo.inventree.org` (data resets periodically).
- **For real use:** self-host InvenTree (the Docker install is the usual route): https://docs.inventree.org/en/stable/start/docker/

## 2. Create a dedicated read-only user

In InvenTree's admin (`/admin/` → Users), create a user such as `dashboard-sync`, then give it a group with
**view** permission on: *Part*, *Part category*, *Stock item*, *Stock location*.
Do not make it staff or superuser. It only needs to read.

## 3. Create an API token for that user

Log in to InvenTree as that user → **Settings → Account → Access Tokens → New token**.
Copy the token (starts with `inv-`). It is only shown once.

## 4. Configure the dashboard

```bash
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
```

Edit `.env`:

```
INVENTREE_URL=https://your-inventree-host      # no trailing /api
INVENTREE_TOKEN=inv-...
```

Also set `webUrl` in `src/environments/environment*.ts` to the same host so "Open in InvenTree" links work.

Restart `npm start`. The badge should turn green: **Live · InvenTree · Synced HH:MM**.

## 5. Shape your InvenTree data so the dashboard reads it well

| Dashboard feature            | Comes from InvenTree                                                     |
|------------------------------|--------------------------------------------------------------------------|
| Product name / SKU           | Part name / **IPN** (falls back to `PRT-00042`)                          |
| Category filter, donut, bars | Part category                                                            |
| Current stock                | Sum of in-stock Stock Items                                              |
| Low / Out of stock status    | Part **Minimum stock** (0 = never "low")                                 |
| Stock value                  | Part pricing (min/max) or Stock Item **purchase price**                  |
| **Sites** (multi-site)       | **Top-level stock locations**, e.g. `Rotterdam DC / Aisle 4 / Bin 12`    |
| Thumbnail                    | Part image                                                               |
| Recent activity              | Most recently updated Stock Items                                        |

Pending orders, shipments today, KPI trend lines and the inventory-flow chart are still sample series. They need InvenTree's order endpoints, which are not wired in yet.

## 6. Production deployment

Build with `npm run build` and run `node dist/inventory-management-system/server/server.mjs`.
Set `INVENTREE_URL` and `INVENTREE_TOKEN` as **real environment variables** on the host (not a `.env` file),
and put the dashboard behind your own login/SSO: anyone who can reach it can read what that token can read.

## Troubleshooting (hover the Sample data badge)

| Message                                   | Fix                                                             |
|-------------------------------------------|-----------------------------------------------------------------|
| InvenTree proxy is not configured         | `.env` missing or incomplete; restart `npm start` after editing |
| InvenTree rejected the API token          | Token revoked/mistyped, or user is inactive                     |
| InvenTree is unreachable from the server  | Wrong `INVENTREE_URL`, or the host can't reach it (VPN/firewall)|
| InvenTree did not respond in time         | Very large dataset or slow server; raise `timeoutMs`            |

## Per-user roles (optional, later)

With the shared proxy token, RBAC uses the demo personas (account menu → *Preview as role*).
To map each person's real InvenTree permissions you need per-user sign-in (each user's own token).
The role mapping for that already exists in `src/app/core/utils/auth.mapper.ts`.
