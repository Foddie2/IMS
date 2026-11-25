using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Ims.Api.Auth;
using Ims.Api.Data;
using Ims.Api.Infrastructure;
using Ims.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------------------------------------------------------------- database (Supabase PostgreSQL)
builder.Services.Configure<DatabaseOptions>(config.GetSection(DatabaseOptions.Section));
var useInMemoryDemo = config.GetValue<bool>("Database:UseInMemoryDemo");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (useInMemoryDemo)
    {
        options.UseInMemoryDatabase("ims-demo")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning));
        return;
    }

    var connectionString = config.GetConnectionString("Default");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException(
            "ConnectionStrings:Default is not set. Run: dotnet user-secrets set \"ConnectionStrings:Default\" \"Host=...\" " +
            "(or set the ConnectionStrings__Default environment variable).");
    }

    options.UseNpgsql(ConnectionStrings.Normalize(connectionString), npgsql =>
        {
            npgsql.MigrationsHistoryTable("__ef_migrations_history", ApplicationDbContext.Schema);
            npgsql.EnableRetryOnFailure(maxRetryCount: 3);
        })
        .UseSnakeCaseNamingConvention();
});

// ---------------------------------------------------------------- authentication (JWT) & authorization (roles)
var jwtSection = config.GetSection(JwtOptions.Section);
builder.Services.Configure<JwtOptions>(jwtSection);
var jwt = jwtSection.Get<JwtOptions>() ?? new JwtOptions();
if (jwt.SigningKey.Length < 32)
{
    throw new InvalidOperationException("Jwt:SigningKey must be at least 32 characters (user-secrets or Jwt__SigningKey env var).");
}
if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing")
    && jwt.SigningKey.Contains(JwtOptions.DevelopmentKeyMarker, StringComparison.Ordinal))
{
    throw new InvalidOperationException("Refusing to start: the development JWT signing key is configured outside Development.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // keep "sub", "role", "email" as issued
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwt.CreateSecurityKey(),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = "name",
            RoleClaimType = "role",
        };
    });
builder.Services.AddAuthorization();

// ---------------------------------------------------------------- application services
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddScoped<AuditLogger>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<StockMovementService>();
builder.Services.AddScoped<PurchaseOrderService>();
builder.Services.AddScoped<ReportService>();

builder.Services
    .AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddHealthChecks().AddDbContextCheck<ApplicationDbContext>("database");

// ---------------------------------------------------------------- CORS (Angular dev server by default)
var allowedOrigins = config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:4200"];
var isDevelopment = builder.Environment.IsDevelopment();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    // In Development, also accept any localhost port (ng serve picks a random port when 4200 is busy).
    .SetIsOriginAllowed(origin =>
        allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)
        || (isDevelopment && Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback))
    .WithHeaders("Authorization", "Content-Type", "Accept")
    .WithMethods("GET", "POST", "PUT", "DELETE")));

// ---------------------------------------------------------------- brute-force protection on login
var loginPermitLimit = config.GetValue("RateLimiting:LoginPermitLimit", 10);
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(RateLimitPolicies.Login, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = loginPermitLimit, Window = TimeSpan.FromMinutes(1) }));
});

// ---------------------------------------------------------------- OpenAPI + Swagger UI
builder.Services.AddOpenApiDocumentation();

var app = builder.Build();

if (useInMemoryDemo)
{
    app.Logger.LogWarning("Database:UseInMemoryDemo is ON – data lives in memory and is lost on restart. Do not use in production.");
}

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment() || config.GetValue<bool>("Swagger:Enabled"))
{
    app.UseSwaggerDocumentation();
}

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous();
app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

await DbInitializer.InitializeAsync(app.Services);

app.Run();

/// <summary>Exposed for WebApplicationFactory in integration tests.</summary>
public partial class Program;
