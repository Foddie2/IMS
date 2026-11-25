using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Ims.Api.Domain;
using Ims.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Services;

/// <summary>SuperAdmin user management: roles, warehouse assignments, activation.</summary>
public sealed class UserService(ApplicationDbContext db, ICurrentUser current, AuditLogger audit, TimeProvider clock)
{
    public async Task<IReadOnlyList<UserAdminDto>> ListAsync(CancellationToken ct) =>
        await db.Users.AsNoTracking()
            .OrderBy(u => u.FullName)
            .Select(u => new UserAdminDto(u.Id, u.FullName, u.Email, u.Role, u.AssignedWarehouseIds, u.IsActive, u.CreatedAt, u.LastLoginAt))
            .ToListAsync(ct);

    public async Task<UserAdminDto> CreateAsync(CreateUserRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
        {
            throw new ConflictException($"A user with email {email} already exists.");
        }

        var warehouses = await ValidateWarehousesAsync(request.Role, request.AssignedWarehouseIds, ct);
        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            PasswordHash = AuthService.HashPassword(request.Password),
            Role = request.Role,
            AssignedWarehouseIds = warehouses,
            CreatedAt = clock.GetUtcNow().UtcDateTime,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        audit.Record(current.Id, "Create", nameof(User), user.Id, new { user.Email, Role = user.Role.ToString(), warehouses });
        await db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    public async Task<UserAdminDto> UpdateAsync(int id, UpdateUserRequest request, CancellationToken ct)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundException($"User {id} not found.");

        var losingSuperAdmin = user.Role == UserRole.SuperAdmin
            && (request.Role != UserRole.SuperAdmin || !request.IsActive);
        if (losingSuperAdmin)
        {
            var otherSuperAdmins = await db.Users.CountAsync(
                u => u.Id != id && u.Role == UserRole.SuperAdmin && u.IsActive, ct);
            if (otherSuperAdmins == 0)
            {
                throw new ConflictException("At least one active SuperAdmin must remain.");
            }
        }

        var before = new { Role = user.Role.ToString(), user.AssignedWarehouseIds, user.IsActive };
        user.FullName = request.FullName.Trim();
        user.Role = request.Role;
        user.AssignedWarehouseIds = await ValidateWarehousesAsync(request.Role, request.AssignedWarehouseIds, ct);
        user.IsActive = request.IsActive;

        audit.Record(current.Id, "Update", nameof(User), user.Id, new
        {
            before,
            after = new { Role = user.Role.ToString(), user.AssignedWarehouseIds, user.IsActive },
        });
        await db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    private async Task<List<int>> ValidateWarehousesAsync(UserRole role, IReadOnlyList<int>? ids, CancellationToken ct)
    {
        var distinct = (ids ?? []).Distinct().ToList();
        if (distinct.Count == 0) return [];

        var existing = await db.Warehouses.Where(w => distinct.Contains(w.Id)).Select(w => w.Id).ToListAsync(ct);
        var unknown = distinct.Except(existing).ToList();
        if (unknown.Count > 0)
        {
            throw new BusinessValidationException($"Unknown warehouse id(s): {string.Join(", ", unknown)}.");
        }
        // Admins/SuperAdmins see every warehouse; keep their list empty to avoid confusion.
        return role == UserRole.User ? distinct : [];
    }

    private static UserAdminDto ToDto(User u) =>
        new(u.Id, u.FullName, u.Email, u.Role, u.AssignedWarehouseIds, u.IsActive, u.CreatedAt, u.LastLoginAt);
}
