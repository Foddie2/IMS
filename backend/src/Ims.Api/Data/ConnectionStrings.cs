using Npgsql;

namespace Ims.Api.Data;

public static class ConnectionStrings
{
    /// <summary>
    /// Accepts either an Npgsql key/value string (<c>Host=...;Password=...</c>) or the URI that
    /// Supabase shows under Connect (<c>postgresql://user:password@host:5432/postgres</c>).
    /// SSL is required unless the string says otherwise.
    /// </summary>
    public static string Normalize(string value)
    {
        value = value.Trim();
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return value;
        }

        var uri = new Uri(value);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')) is { Length: > 0 } db ? db : "postgres",
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            SslMode = SslMode.Require,
        };

        // Honour ?sslmode=... if present in the URI.
        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length == 2 && parts[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<SslMode>(parts[1], ignoreCase: true, out var mode))
            {
                builder.SslMode = mode;
            }
        }
        return builder.ConnectionString;
    }
}
