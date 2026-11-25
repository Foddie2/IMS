using Ims.Api.Data;
using Npgsql;

namespace Ims.Api.Tests;

public sealed class ConnectionStringTests
{
    [Fact]
    public void Supabase_pooler_uri_is_converted_with_ssl_required()
    {
        var result = new NpgsqlConnectionStringBuilder(ConnectionStrings.Normalize(
            "postgresql://postgres.abcdefgh:p%40ss%3Aw0rd%21@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"));

        Assert.Equal("aws-0-eu-central-1.pooler.supabase.com", result.Host);
        Assert.Equal(5432, result.Port);
        Assert.Equal("postgres", result.Database);
        Assert.Equal("postgres.abcdefgh", result.Username);
        Assert.Equal("p@ss:w0rd!", result.Password);
        Assert.Equal(SslMode.Require, result.SslMode);
    }

    [Fact]
    public void Key_value_strings_are_left_untouched()
    {
        const string value = "Host=db.example.com;Port=5432;Database=postgres;Username=postgres;Password=x;SSL Mode=Require";
        Assert.Equal(value, ConnectionStrings.Normalize("  " + value + " "));
    }
}
