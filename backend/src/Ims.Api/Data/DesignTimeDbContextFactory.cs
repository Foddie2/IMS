using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Ims.Api.Data;

/// <summary>
/// Used by <c>dotnet ef</c>. Reads the same configuration as the API (appsettings, user-secrets,
/// environment variables). Without a connection string it falls back to a placeholder, which is
/// enough for <c>migrations add</c> (no connection needed) but not for <c>database update</c>.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddUserSecrets<DesignTimeDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = "Host=localhost;Database=design_time_placeholder";
        }

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(ConnectionStrings.Normalize(connectionString), npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", ApplicationDbContext.Schema))
            .UseSnakeCaseNamingConvention()
            .Options;
        return new ApplicationDbContext(options);
    }
}
