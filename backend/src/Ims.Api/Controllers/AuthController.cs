using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Infrastructure;
using Ims.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Ims.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public sealed class AuthController(AuthService auth, ICurrentUser current) : ControllerBase
{
    /// <summary>Exchange email + password for a JWT bearer token.</summary>
    /// <response code="200">Signed in; use <c>accessToken</c> as <c>Authorization: Bearer …</c>.</response>
    /// <response code="401">Wrong email or password, or the account is disabled.</response>
    /// <response code="429">Too many attempts from this address; wait a minute.</response>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Login)]
    [ProducesResponseType<LoginResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await auth.LoginAsync(request, ct);
        return result is null
            ? Problem(title: "Sign-in failed", detail: "Incorrect email or password.", statusCode: StatusCodes.Status401Unauthorized)
            : Ok(result);
    }

    /// <summary>The signed-in user's profile (role and warehouse assignments are read live from the database).</summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType<UserDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        var profile = await auth.GetProfileAsync(current.Id, ct);
        return profile is null ? Unauthorized() : Ok(profile);
    }
}
