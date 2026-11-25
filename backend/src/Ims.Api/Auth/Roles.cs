namespace Ims.Api.Auth;

/// <summary>Role-name combinations for <c>[Authorize(Roles = ...)]</c>. Higher roles include lower ones.</summary>
public static class Roles
{
    public const string User = nameof(Domain.UserRole.User);
    public const string Admin = nameof(Domain.UserRole.Admin);
    public const string SuperAdmin = nameof(Domain.UserRole.SuperAdmin);

    /// <summary>Any signed-in role.</summary>
    public const string AnyUser = $"{User},{Admin},{SuperAdmin}";

    /// <summary>Admin or SuperAdmin.</summary>
    public const string AdminOrAbove = $"{Admin},{SuperAdmin}";

    public const string SuperAdminOnly = SuperAdmin;
}
