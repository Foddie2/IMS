using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Services;

/// <summary>Aggregated and per-warehouse stock, restricted to the caller's warehouses.</summary>
public sealed class InventoryService(ApplicationDbContext db, ICurrentUser current)
{
    public async Task<IReadOnlyList<InventoryItemDto>> GetAsync(
        string? search, int? categoryId, int? warehouseId, CancellationToken ct)
    {
        var scope = Projections.Narrow(await ScopeAsync(ct), warehouseId);
        var showCost = current.IsAdminOrAbove;
        var inScope = Projections.InventoryInScope(scope);

        var query = db.Products.AsNoTracking().Where(p => p.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term));
        }
        if (categoryId is not null)
        {
            query = query.Where(p => p.CategoryId == categoryId);
        }

        var rows = await query
            .OrderBy(p => p.Name)
            .Select(p => new
            {
                p.Id,
                p.Sku,
                p.Name,
                p.Description,
                p.CategoryId,
                CategoryName = p.Category != null ? p.Category.Name : null,
                p.UnitPrice,
                p.Units,
                p.MinimumStock,
                p.Barcode,
                p.ImageUrl,
                Stock = p.Inventory.AsQueryable()
                    .Where(inScope)
                    .OrderBy(i => i.Warehouse.Code)
                    .Select(i => new WarehouseStockDto(i.WarehouseId, i.Warehouse.Code, i.Warehouse.Name, i.Quantity, i.UpdatedAt))
                    .ToList(),
            })
            .ToListAsync(ct);

        return rows.Select(r =>
        {
            var total = r.Stock.Sum(s => s.Quantity);
            return new InventoryItemDto(
                r.Id, r.Sku, r.Name, r.Description, r.CategoryId, r.CategoryName,
                showCost ? r.UnitPrice : null,
                r.Units, r.MinimumStock, r.Barcode, r.ImageUrl,
                total, StockStatusRules.For(total, r.MinimumStock), r.Stock);
        }).ToList();
    }

    public async Task<IReadOnlyList<LowStockItemDto>> GetLowStockAsync(int? warehouseId, CancellationToken ct)
    {
        var items = await GetAsync(null, null, warehouseId, ct);
        return items
            .Where(i => i.StockStatus != StockStatus.InStock)
            .Select(i => new LowStockItemDto(
                i.ProductId, i.Sku, i.Name, i.TotalQuantity, i.MinimumStock,
                Math.Max(0, i.MinimumStock - i.TotalQuantity), i.StockStatus))
            .OrderByDescending(i => i.StockStatus == StockStatus.OutOfStock)
            .ThenByDescending(i => i.Shortfall)
            .ToList();
    }

    private async Task<int[]?> ScopeAsync(CancellationToken ct) =>
        (await current.GetAccessibleWarehouseIdsAsync(ct))?.ToArray();
}
