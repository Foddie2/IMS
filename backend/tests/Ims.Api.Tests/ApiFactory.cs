using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Ims.Api.Tests;

/// <summary>
/// Boots the real API (routing, JWT, roles, validation, services, seeding) on an isolated
/// in-memory database. Each test class gets its own database via IClassFixture.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly string _databaseName = $"ims-tests-{Guid.NewGuid():N}";
    private readonly Dictionary<string, string> _tokens = [];

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", "Host=unused-in-tests");
        builder.UseSetting("Jwt:SigningKey", "test-signing-key-0123456789abcdef0123456789abcdef");
        builder.UseSetting("RateLimiting:LoginPermitLimit", "1000");

        builder.ConfigureServices(services =>
        {
            // Swap Npgsql for the in-memory provider.
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.RemoveAll(typeof(IDbContextOptionsConfiguration<ApplicationDbContext>));
            services.AddDbContext<ApplicationDbContext>(o => o
                .UseInMemoryDatabase(_databaseName)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        });
    }

    /// <summary>An HttpClient authenticated as one of the seeded demo accounts.</summary>
    public async Task<HttpClient> ClientForAsync(string email)
    {
        if (!_tokens.TryGetValue(email, out var token))
        {
            var password = DbInitializer.DemoAccounts.Single(a => a.Email == email).Password;
            var response = await CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
            response.EnsureSuccessStatusCode();
            token = (await response.Content.ReadFromJsonAsync<LoginResponse>(Json))!.AccessToken;
            _tokens[email] = token;
        }

        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public const string SuperAdmin = "admin@ims.com";
    public const string Admin = "manager@ims.com";
    public const string User = "operator@ims.com";
}
