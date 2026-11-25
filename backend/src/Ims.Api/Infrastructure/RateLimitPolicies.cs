namespace Ims.Api.Infrastructure;

public static class RateLimitPolicies
{
    /// <summary>10 login attempts per minute per client IP.</summary>
    public const string Login = "login";
}
