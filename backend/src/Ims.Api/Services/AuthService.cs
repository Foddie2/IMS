using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Ims.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Services;

public sealed class AuthService(ApplicationDbContext db, JwtTokenService tokens, AuditLogger audit, TimeProvider clock)
{
    public const int BcryptWorkFactor = 12;

    // Verified when the email is unknown, so response time doesn't reveal which emails exist.
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("not-a-real-password", BcryptWorkFactor);

    public static string HashPassword(string password) => BCrypt.Net.BCrypt.HashPassword(password, BcryptWorkFactor);

    /// <summary>Returns <c>null</c> for any failure (unknown email, wrong password, inactive user).</summary>
    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email, ct);

        var passwordOk = BCrypt.Net.BCrypt.Verify(request.Password, user?.PasswordHash ?? DummyHash);
        if (user is null || !passwordOk || !user.IsActive)
        {
            audit.Record(user?.Id, "LoginFailed", nameof(User), user?.Id, new { email });
            await db.SaveChangesAsync(ct);
            return null;
        }

        user.LastLoginAt = clock.GetUtcNow().UtcDateTime;
        audit.Record(user.Id, "Login", nameof(User), user.Id);
        await db.SaveChangesAsync(ct);

        var token = tokens.Issue(user);
        return new LoginResponse(token.AccessToken, token.ExpiresAt, ToDto(user));
    }

    public async Task<UserDto?> GetProfileAsync(int userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);
        return user is null ? null : ToDto(user);
    }

    public static UserDto ToDto(User user) =>
        new(user.Id, user.FullName, user.Email, user.Role, user.AssignedWarehouseIds);
}
