using System.Linq.Expressions;
using Ims.Api.Contracts;
using Ims.Api.Domain;

namespace Ims.Api.Services;

/// <summary>Reusable EF-translatable projections and warehouse-scope filters.</summary>
public static class Projections
{
    public static readonly Expression<Func<StockMovement, StockMovementDto>> Movement = m => new StockMovementDto(
        m.Id,
        m.ProductId,
        m.Product.Sku,
        m.Product.Name,
        m.WarehouseId,
        m.Warehouse.Code,
        m.Warehouse.Name,
        m.Type,
        m.QuantityDelta,
        m.ReferenceNumber,
        m.Notes,
        m.PerformedByUserId,
        m.PerformedByUser != null ? m.PerformedByUser.FullName : null,
        m.CreatedAt);

    /// <summary>Inventory rows visible for a scope (<c>null</c> = all warehouses).</summary>
    public static Expression<Func<WarehouseInventory, bool>> InventoryInScope(int[]? warehouseIds) =>
        warehouseIds is null ? _ => true : i => warehouseIds.Contains(i.WarehouseId);

    public static IQueryable<StockMovement> InScope(this IQueryable<StockMovement> query, int[]? warehouseIds) =>
        warehouseIds is null ? query : query.Where(m => warehouseIds.Contains(m.WarehouseId));

    public static IQueryable<Warehouse> InScope(this IQueryable<Warehouse> query, int[]? warehouseIds) =>
        warehouseIds is null ? query : query.Where(w => warehouseIds.Contains(w.Id));

    /// <summary>Narrows a scope to one warehouse; an empty result means "no access".</summary>
    public static int[]? Narrow(int[]? scope, int? warehouseId) =>
        warehouseId is null ? scope
        : scope is null ? [warehouseId.Value]
        : scope.Contains(warehouseId.Value) ? [warehouseId.Value] : [];
}
