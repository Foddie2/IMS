using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ims.Api.Controllers;

[ApiController]
[Route("api/stock-movements")]
[Authorize(Roles = Roles.AnyUser)]
[Produces("application/json")]
public sealed class StockMovementsController(StockMovementService movements) : ControllerBase
{
    /// <summary>Recent stock movements in the warehouses you can access (newest first).</summary>
    [HttpGet]
    public Task<IReadOnlyList<StockMovementDto>> List([FromQuery] StockMovementQuery query, CancellationToken ct) =>
        movements.ListAsync(query, ct);

    /// <summary>
    /// Record a movement. Runs in a single transaction: validates stock, updates warehouse quantities,
    /// writes the movement(s) and an audit entry. Transfers create an out-leg and an in-leg.
    /// </summary>
    /// <response code="201">Recorded; returns the movement rows and the new stock levels.</response>
    /// <response code="400">Invalid quantity/type combination.</response>
    /// <response code="403">You are not assigned to one of the warehouses.</response>
    /// <response code="404">Unknown product or warehouse.</response>
    /// <response code="409">Insufficient stock (<c>available</c> and <c>requested</c> are included).</response>
    [HttpPost]
    [ProducesResponseType<StockMovementResultDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<StockMovementResultDto>> Create(CreateStockMovementRequest request, CancellationToken ct)
    {
        var result = await movements.RecordAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}
