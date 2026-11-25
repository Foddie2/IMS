using System.IdentityModel.Tokens.Jwt;
using Ims.Api.Data;
using Ims.Api.Domain;
using Ims.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Auth;

/// <summary>The authenticated caller, plus the warehouse scope their role allows.</summary>
public interface ICurrentUser
{
    int Id { get; }
    UserRole Role { get; }
    bool IsAdminOrAbove { get; }

    /// <summary><c>null</c> = every warehouse (Admin/SuperAdmin); otherwise the assigned ids.</summary>
    Task<IReadOnlySet<int>?> GetAccessibleWarehouseIdsAsync(CancellationToken ct = default);

    /// <summary>Throws 403 when the caller may not act on this warehouse.</summary>
    Task EnsureWarehouseAccessAsync(int warehouseId, CancellationToken ct = default);
}

public sealed class CurrentUser(IHttpContextAccessor accessor, ApplicationDbContext db) : ICurrentUser
{
    private IReadOnlySet<int>? _warehouses;
    private bool _warehousesLoaded;

    private System.Security.Claims.ClaimsPrincipal Principal =>
        accessor.HttpContext?.User ?? throw new InvalidOperationException("No HTTP context.");

    public int Id =>
        int.TryParse(Principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id)
            ? id
            : throw new ForbiddenException("Missing user id claim.");

    public UserRole Role =>
        Enum.TryParse<UserRole>(Principal.FindFirst("role")?.Value, out var role)
            ? role
            : throw new ForbiddenException("Missing role claim.");

    public bool IsAdminOrAbove => Role >= UserRole.Admin;

    public async Task<IReadOnlySet<int>?> GetAccessibleWarehouseIdsAsync(CancellationToken ct = default)
    {
        if (IsAdminOrAbove) return null;
        if (_warehousesLoaded) return _warehouses;

        // Read from the database, not the token, so assignment changes apply immediately.
        var assigned = await db.Users.AsNoTracking()
            .Where(u => u.Id == Id && u.IsActive)
            .Select(u => u.AssignedWarehouseIds)
            .SingleOrDefaultAsync(ct) ?? [];
        _warehouses = assigned.ToHashSet();
        _warehousesLoaded = true;
        return _warehouses;
    }

    public async Task EnsureWarehouseAccessAsync(int warehouseId, CancellationToken ct = default)
    {
        var accessible = await GetAccessibleWarehouseIdsAsync(ct);
        if (accessible is not null && !accessible.Contains(warehouseId))
        {
            throw new ForbiddenException($"You are not assigned to warehouse {warehouseId}.");
        }
    }
}
