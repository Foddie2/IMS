# IMS – setup guide

```
Angular (HttpClient + JWT)  ──►  IMS API (ASP.NET Core 10)  ──►  Supabase PostgreSQL (schema "ims")
   src/                          backend/src/Ims.Api             private schema, not exposed to Supabase's Data API
```

The browser never talks to the database. Only the API holds the connection string.

## Prerequisites

- .NET SDK 10 (`dotnet --version` → 10.x)
- Node.js 22+ and `npm install`
- A Supabase project (only its PostgreSQL database is used)

## 1. Create the database (one paste)

In Supabase open **SQL Editor → New query**, paste the whole of `supabase/ims_master.sql` and click **Run**.
It creates the private `ims` schema, every table, the demo data and the logins (including the owner SuperAdmin),
and ends with a summary row (5 warehouses, 12 products, 4 users, 4358 units). It is safe to run again.

Only needed on a project that still has tables from the earlier browser-only version: run `supabase/reset.sql` first.

## 2. Get the PostgreSQL connection string

In Supabase, click **Connect** (top bar) and choose **Session pooler**. It works on IPv4 networks; the "Direct connection" host is IPv6-only.
Convert the connection details to this format:

```
Host=aws-0-<region>.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<your-database-password>;SSL Mode=Require
```

- The password is the **database password**, not your Supabase login. Forgot it? Go to **Project Settings → Database → Reset database password**.
- Use port **5432** (session mode). The transaction pooler on 6543 does not work well with EF Core migrations.

## 3. Store secrets (never in appsettings.json)

Easiest: `powershell -ExecutionPolicy Bypass -File backend\set-connection.ps1` – paste the Session pooler URI,
type the password (hidden), and it saves and tests the connection. Or manually:

```powershell
cd backend/src/Ims.Api
dotnet user-secrets set "ConnectionStrings:Default" "Host=...;Port=5432;Database=postgres;Username=postgres.<ref>;Password=...;SSL Mode=Require"
# Optional locally (a DEV-ONLY key is in appsettings.Development.json); required in production:
dotnet user-secrets set "Jwt:SigningKey" "<at least 32 random characters>"
```

## 4. Create the database schema (EF Core migrations)

```powershell
cd backend
dotnet tool restore                                   # installs dotnet-ef from the tool manifest
dotnet ef database update --project src/Ims.Api       # creates schema "ims" and all tables
```

You can also skip this step: the API applies pending migrations on startup (`Database:ApplyMigrationsOnStartup`).
On the first start against an empty database it also seeds warehouses, products, 12 months of stock history, purchase orders and three logins.

| Role       | Email               | Password       |
|------------|---------------------|----------------|
| SuperAdmin | admin@ims.com       | Admin123!      |
| Admin      | manager@ims.com     | Manager123!    |
| User       | operator@ims.com    | Operator123!   |

## 5. Run the API and open Swagger

```powershell
npm run start:api          # = dotnet run --project backend/src/Ims.Api --launch-profile http
```

- Swagger UI: http://localhost:5000/swagger
  1. Call `POST /api/auth/login` with a demo account.
  2. Copy the `accessToken`.
  3. Click **Authorize** and paste the token.
- Health check: http://localhost:5000/health (checks the database).

**No database yet?** Run with an in-memory demo database instead (data is lost on restart):
`$env:Database__UseInMemoryDemo="true"; npm run start:api`

## 6. Run Angular and sign in

```powershell
npm start                  # http://localhost:4200
```

Use the **Sign in as Super Admin / Admin / User** buttons on the login page, or type the credentials.
The dashboard header shows **Live · IMS API** with the last sync time.

## Tests

```powershell
npm run test:api           # 27 backend integration tests (auth, RBAC, transactions, reports)
npm test                   # Angular unit tests
```

## Production checklist

| Setting (environment variable)          | Value |
|-----------------------------------------|-------|
| `ConnectionStrings__Default`            | Supabase session-pooler connection string |
| `Jwt__SigningKey`                       | 64+ random characters (the DEV-ONLY key is refused outside Development) |
| `Cors__AllowedOrigins__0`               | Your Angular site's origin, e.g. `https://ims.example.com` |
| `Database__SeedDemoData`                | `false` once you have real data and have changed the demo passwords |
| `Swagger__Enabled`                      | `false` (default) unless you want public API docs |

In the Angular app, set `apiUrl` in `src/environments/environment.ts` to the deployed API.
For production, set `showDemoLogins: false` there too.
