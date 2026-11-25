using System.Data;
using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Ims.Api.Domain;
using Ims.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Ims.Api.Services;

/// <summary>
/// Records stock movements atomically.
///
/// Every call runs in one database transaction that
///   1. re-reads the affected <see cref="WarehouseInventory"/> rows,
///   2. rejects outbound/transfer/adjustment moves that would go below zero,
///   3. updates the quantities, writes the <see cref="StockMovement"/> rows and an <see cref="AuditLog"/>,
///   4. commits – or rolls everything back.
///
/// Concurrent edits of the same stock row are detected through PostgreSQL's <c>xmin</c>
/// (optimistic concurrency) and retried, so two simultaneous outbound moves can never both
/// spend the same units. A CHECK constraint (quantity &gt;= 0) is the final safety net.
/// </summary>
public sealed class StockMovementService(
    ApplicationDbContext db,
    ICurrentUser current,
    AuditLogger audit,
    TimeProvider clock,
    ILogger<StockMovementService> logger)
{
    private const int MaxConcurrencyAttempts = 5;

    private sealed record Leg(int WarehouseId, int Delta);

    public async Task<StockMovementResultDto> RecordAsync(CreateStockMovementRequest request, CancellationToken ct)
    {
        var type = request.Type ?? throw new BusinessValidationException("Movement type is required.");
        var legs = BuildLegs(type, request);

        // Validate references and permissions up front (outside the retry loop).
        var product = await db.Products.AsNoTracking()
            .Where(p => p.Id == request.ProductId && p.IsActive)
            .Select(p => new { p.Id, p.Sku, p.Name })
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException($"Product {request.ProductId} not found.");

        var warehouseIds = legs.Select(l => l.WarehouseId).Distinct().ToArray();
        var warehouses = await db.Warehouses.AsNoTracking()
            .Where(w => warehouseIds.Contains(w.Id) && w.IsActive)
            .ToDictionaryAsync(w => w.Id, w => w.Code, ct);
        foreach (var id in warehouseIds)
        {
            if (!warehouses.ContainsKey(id)) throw new NotFoundException($"Warehouse {id} not found or inactive.");
            await current.EnsureWarehouseAccessAsync(id, ct);
        }

        var userId = current.Id;
        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            for (var attempt = 1; ; attempt++)
            {
                db.ChangeTracker.Clear();
                await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
                try
                {
                    var now = clock.GetUtcNow().UtcDateTime;
                    var movements = new List<StockMovement>();

                    foreach (var leg in legs)
                    {
                        var row = await db.Inventory.SingleOrDefaultAsync(
                            i => i.ProductId == product.Id && i.WarehouseId == leg.WarehouseId, ct);

                        var available = row?.Quantity ?? 0;
                        var newQuantity = available + leg.Delta;
                        if (newQuantity < 0)
                        {
                            throw new InsufficientStockException(product.Sku, warehouses[leg.WarehouseId], available, -leg.Delta);
                        }

                        if (row is null)
                        {
                            row = new WarehouseInventory { ProductId = product.Id, WarehouseId = leg.WarehouseId };
                            db.Inventory.Add(row);
                        }
                        row.Quantity = newQuantity;
                        row.UpdatedAt = now;

                        var movement = new StockMovement
                        {
                            ProductId = product.Id,
                            WarehouseId = leg.WarehouseId,
                            Type = type,
                            QuantityDelta = leg.Delta,
                            ReferenceNumber = Clean(request.ReferenceNumber),
                            Notes = Clean(request.Notes),
                            PerformedByUserId = userId,
                            CreatedAt = now,
                        };
                        db.StockMovements.Add(movement);
                        movements.Add(movement);
                    }

                    await db.SaveChangesAsync(ct);

                    audit.Record(userId, $"StockMovement.{type}", nameof(StockMovement), movements[0].Id, new
                    {
                        product = product.Sku,
                        legs = legs.Select(l => new { warehouse = warehouses[l.WarehouseId], delta = l.Delta }),
                        movementIds = movements.Select(m => m.Id),
                        request.ReferenceNumber,
                    });
                    await db.SaveChangesAsync(ct);
                    await tx.CommitAsync(ct);

                    return await BuildResultAsync(movements.Select(m => m.Id).ToArray(), product.Id, warehouseIds, ct);
                }
                catch (Exception ex) when (IsConcurrencyConflict(ex) && attempt < MaxConcurrencyAttempts)
                {
                    await tx.RollbackAsync(ct);
                    logger.LogInformation("Stock row changed concurrently (attempt {Attempt}); retrying.", attempt);
                }
            }
        });
    }

    public async Task<IReadOnlyList<StockMovementDto>> ListAsync(StockMovementQuery query, CancellationToken ct)
    {
        if (query.WarehouseId is { } wid) await current.EnsureWarehouseAccessAsync(wid, ct);
        var scope = Projections.Narrow((await current.GetAccessibleWarehouseIdsAsync(ct))?.ToArray(), query.WarehouseId);
        var take = Math.Clamp(query.Take ?? 50, 1, 500);

        var movements = db.StockMovements.AsNoTracking().InScope(scope);
        if (query.ProductId is not null) movements = movements.Where(m => m.ProductId == query.ProductId);
        if (query.Type is not null) movements = movements.Where(m => m.Type == query.Type);

        return await movements
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(take)
            .Select(Projections.Movement)
            .ToListAsync(ct);
    }

    private static List<Leg> BuildLegs(StockMovementType type, CreateStockMovementRequest r)
    {
        if (r.Quantity == 0) throw new BusinessValidationException("Quantity must not be zero.");

        switch (type)
        {
            case StockMovementType.Inbound:
            case StockMovementType.Outbound:
                if (r.Quantity < 0) throw new BusinessValidationException($"{type} quantity must be positive.");
                if (r.DestinationWarehouseId is not null)
                    throw new BusinessValidationException("Destination warehouse is only valid for transfers.");
                return [new Leg(r.WarehouseId, type == StockMovementType.Inbound ? r.Quantity : -r.Quantity)];

            case StockMovementType.Adjustment:
                if (r.DestinationWarehouseId is not null)
                    throw new BusinessValidationException("Destination warehouse is only valid for transfers.");
                return [new Leg(r.WarehouseId, r.Quantity)];

            case StockMovementType.Transfer:
                if (r.Quantity < 0) throw new BusinessValidationException("Transfer quantity must be positive.");
                if (r.DestinationWarehouseId is not { } destination)
                    throw new BusinessValidationException("Transfers need a destination warehouse.");
                if (destination == r.WarehouseId)
                    throw new BusinessValidationException("Source and destination warehouse must differ.");
                return [new Leg(r.WarehouseId, -r.Quantity), new Leg(destination, r.Quantity)];

            default:
                throw new BusinessValidationException($"Unsupported movement type {type}.");
        }
    }

    private async Task<StockMovementResultDto> BuildResultAsync(
        long[] movementIds, int productId, int[] warehouseIds, CancellationToken ct)
    {
        var movements = await db.StockMovements.AsNoTracking()
            .Where(m => movementIds.Contains(m.Id))
            .OrderBy(m => m.Id)
            .Select(Projections.Movement)
            .ToListAsync(ct);

        var stock = await db.Inventory.AsNoTracking()
            .Where(i => i.ProductId == productId && warehouseIds.Contains(i.WarehouseId))
            .OrderBy(i => i.Warehouse.Code)
            .Select(i => new WarehouseStockDto(i.WarehouseId, i.Warehouse.Code, i.Warehouse.Name, i.Quantity, i.UpdatedAt))
            .ToListAsync(ct);

        return new StockMovementResultDto(movements, stock);
    }

    /// <summary>Lost update (xmin changed) or a racing first insert of the same stock row.</summary>
    private static bool IsConcurrencyConflict(Exception ex) =>
        ex is DbUpdateConcurrencyException
        || ex is DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } };

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
