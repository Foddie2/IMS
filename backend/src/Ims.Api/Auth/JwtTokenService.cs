using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Ims.Api.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Ims.Api.Auth;

public sealed class JwtOptions
{
    public const string Section = "Jwt";
    public const string DevelopmentKeyMarker = "DEV-ONLY";

    public string Issuer { get; set; } = "Ims.Api";
    public string Audience { get; set; } = "Ims.Web";

    /// <summary>HMAC-SHA256 key, at least 32 characters. Supply via user-secrets / environment in production.</summary>
    public string SigningKey { get; set; } = "";
    public int ExpiryMinutes { get; set; } = 480;

    public SymmetricSecurityKey CreateSecurityKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}

public sealed record IssuedToken(string AccessToken, DateTime ExpiresAt);

public sealed class JwtTokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    private readonly JwtOptions _options = options.Value;

    public IssuedToken Issue(User user)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var expires = now.AddMinutes(_options.ExpiryMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Name, user.FullName),
            new("role", user.Role.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: new SigningCredentials(_options.CreateSecurityKey(), SecurityAlgorithms.HmacSha256));

        return new IssuedToken(new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
