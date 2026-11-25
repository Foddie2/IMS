<#
  Stores the Supabase PostgreSQL connection string for the IMS API (as a .NET user-secret,
  outside the repository) and tests it. Run from anywhere:

    powershell -ExecutionPolicy Bypass -File backend\set-connection.ps1

  1. Supabase -> Connect -> Connection String -> "Session pooler" -> copy the URI
     (postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres)
  2. Paste it when asked (keep the [YOUR-PASSWORD] placeholder).
  3. Type the database password when asked (input is hidden).
#>
$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'src\Ims.Api'
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) { $env:Path = "C:\Program Files\dotnet;$env:Path" }

Write-Host "`nIMS - connect the API to Supabase PostgreSQL" -ForegroundColor Cyan

# A running API locks its .exe, which breaks the build used by the connection test below.
# It has to restart anyway to pick up the new connection string.
$running = Get-Process -Name Ims.Api -ErrorAction SilentlyContinue
if ($running) {
  Write-Host 'Stopping the running IMS API (it must restart to use the new database)...' -ForegroundColor Yellow
  $running | Stop-Process -Force
  Start-Sleep -Milliseconds 500
}
$uri = (Read-Host 'Paste the Session pooler URI from Supabase').Trim().Trim("'").Trim('"')
if ($uri -notmatch '^postgres(ql)?://([^:@/]+)(:[^@]*)?@([^:/]+)(:\d+)?/') {
  Write-Host 'That does not look like a postgresql:// URI. Copy it from Supabase -> Connect -> Session pooler.' -ForegroundColor Red
  exit 1
}
$user = $Matches[2]; $hostName = $Matches[4]; $port = if ($Matches[5]) { $Matches[5].TrimStart(':') } else { '5432' }

if ($hostName -like 'db.*.supabase.co') {
  Write-Host "Warning: '$hostName' is the DIRECT connection (IPv6 only). If the test below times out, use the Session pooler URI instead." -ForegroundColor Yellow
}
if ($hostName -like '*pooler.supabase.com' -and $user -notlike 'postgres.*') {
  Write-Host "Warning: pooler usernames look like 'postgres.<project-ref>', not '$user'." -ForegroundColor Yellow
}
if ($port -eq '6543') {
  Write-Host 'Warning: port 6543 is the TRANSACTION pooler. Use the Session pooler (port 5432) for this API.' -ForegroundColor Yellow
}

$secure = Read-Host 'Database password (hidden)' -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if ([string]::IsNullOrEmpty($plain)) { Write-Host 'No password entered.' -ForegroundColor Red; exit 1 }
$encoded = [Uri]::EscapeDataString($plain)

# Put the (URL-encoded) password into the URI, replacing [YOUR-PASSWORD] or any password already there.
$withPassword = $uri -replace '^(postgres(ql)?://[^:@/]+)(:[^@]*)?@', ('$1:' + $encoded.Replace('$', '$$') + '@')

dotnet user-secrets set 'ConnectionStrings:Default' $withPassword --project $project | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'Could not save the user-secret.' -ForegroundColor Red; exit 1 }
Write-Host "Saved as user-secret ConnectionStrings:Default (host $hostName, user $user)." -ForegroundColor Green

Write-Host "`nTesting the connection (read-only)..." -ForegroundColor Cyan
Push-Location (Join-Path $PSScriptRoot '.')
try {
  dotnet tool restore | Out-Null
  $output = dotnet ef migrations list --project $project 2>&1 | Out-String
} finally { Pop-Location }

if ($output -match '(?im)^\s*\d{14}_\w+') {
  Write-Host 'Connected to Supabase.' -ForegroundColor Green
  if ($output -match 'Pending') {
    Write-Host 'Tables not created yet - they are created automatically on the first "npm run start:api".'
  }
  Write-Host "`nNext: stop any running API (Ctrl+C), then run:  npm run start:api   and   npm run test:smoke"
} else {
  $first = ($output -split "`r?`n" | Where-Object { $_ -match 'password|tenant|timeout|host|ssl|refused|resolve|exception|error' } | Select-Object -First 3) -join "`n"
  Write-Host "Connection test failed:`n$first" -ForegroundColor Red
  Write-Host @'

  password authentication failed  -> wrong password (reset it, then rerun this script)
  Tenant or user not found        -> username must be postgres.<project-ref>, or wrong region in the host
  timeout / No such host          -> use the Session pooler URI (not db.<ref>.supabase.co)
'@
  exit 1
}
