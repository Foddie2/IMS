using System.Globalization;
using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Ims.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Services;

/// <summary>Dashboard and report aggregates, always limited to the caller's warehouses.</summary>
public sealed class ReportService(
    ApplicationDbContext db,
    ICurrentUser current,
    InventoryService inventory,
    TimeProvider clock)
{
    private const int TrendDays = 9;

    public async Task<InventorySummaryDto> GetInventorySummaryAsync(int? warehouseId, CancellationToken ct)
    {
        if (warehouseId is { } wid) await current.EnsureWarehouseAccessAsync(wid, ct);
        var scope = Projections.Narrow((await current.GetAccessibleWarehouseIdsAsync(ct))?.ToArray(), warehouseId);
        var showCost = current.IsAdminOrAbove;
        var items = await inventory.GetAsync(null, null, warehouseId, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        var today = now.Date;

        var categories = items
            .GroupBy(i => new { i.CategoryId, Name = i.CategoryName ?? "Uncategorized" })
            .Select(g => new CategoryBreakdownDto(
                g.Key.CategoryId,
                g.Key.Name,
                g.Count(),
                g.Sum(i => i.TotalQuantity),
                showCost ? g.Sum(i => i.TotalQuantity * (i.UnitPrice ?? 0)) : null))
            .OrderByDescending(c => c.Units)
            .ToList();

        var orders = db.PurchaseOrders.AsNoTracking().Where(o => o.Status == PurchaseOrderStatus.Submitted);
        if (scope is not null) orders = orders.Where(o => scope.Contains(o.WarehouseId));
        var pending = await orders.CountAsync(ct);

        var since = now.AddDays(-30);
        var recentOrders = db.PurchaseOrders.AsNoTracking().Where(o => o.CreatedAt >= since && o.Status != PurchaseOrderStatus.Cancelled);
        if (scope is not null) recentOrders = recentOrders.Where(o => scope.Contains(o.WarehouseId));
        var ordersLast30Days = await recentOrders.CountAsync(ct);

        var trendStart = today.AddDays(-(TrendDays - 1));
        var outboundDates = await db.StockMovements.AsNoTracking().InScope(scope)
            .Where(m => m.Type == StockMovementType.Outbound && m.CreatedAt >= trendStart)
            .Select(m => m.CreatedAt)
            .ToListAsync(ct);
        var trend = Enumerable.Range(0, TrendDays)
            .Select(d => outboundDates.Count(t => t.Date == trendStart.AddDays(d)))
            .ToList();

        var recent = await db.StockMovements.AsNoTracking().InScope(scope)
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(10)
            .Select(Projections.Movement)
            .ToListAsync(ct);

        return new InventorySummaryDto(
            TotalItems: items.Sum(i => i.TotalQuantity),
            SkuCount: items.Count,
            TotalStockValue: showCost ? items.Sum(i => i.TotalQuantity * (i.UnitPrice ?? 0)) : null,
            LowStockCount: items.Count(i => i.StockStatus == StockStatus.LowStock),
            OutOfStockCount: items.Count(i => i.StockStatus == StockStatus.OutOfStock),
            PendingPurchaseOrders: pending,
            PurchaseOrdersLast30Days: ordersLast30Days,
            ShipmentsToday: trend[^1],
            ShipmentsTrend: trend,
            CategoryBreakdown: categories,
            RecentActivity: recent,
            GeneratedAt: now);
    }

    /// <summary>Monthly inbound vs outbound units, plus the closing stock level of each month.</summary>
    public async Task<IReadOnlyList<StockFlowPointDto>> GetStockFlowAsync(int months, int? warehouseId, CancellationToken ct)
    {
        months = Math.Clamp(months, 1, 36);
        if (warehouseId is { } wid) await current.EnsureWarehouseAccessAsync(wid, ct);
        var scope = Projections.Narrow((await current.GetAccessibleWarehouseIdsAsync(ct))?.ToArray(), warehouseId);
        var now = clock.GetUtcNow().UtcDateTime;
        var firstMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-(months - 1));

        var grouped = await db.StockMovements.AsNoTracking().InScope(scope)
            .Where(m => m.CreatedAt >= firstMonth)
            .GroupBy(m => new { m.CreatedAt.Year, m.CreatedAt.Month, m.Type })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                g.Key.Type,
                In = g.Sum(m => m.QuantityDelta > 0 ? m.QuantityDelta : 0),
                Out = g.Sum(m => m.QuantityDelta < 0 ? -m.QuantityDelta : 0),
                Net = g.Sum(m => m.QuantityDelta),
            })
            .ToListAsync(ct);

        var inventoryQuery = db.Inventory.AsNoTracking();
        if (scope is not null) inventoryQuery = inventoryQuery.Where(i => scope.Contains(i.WarehouseId));
        var currentTotal = await inventoryQuery.SumAsync(i => (int?)i.Quantity, ct) ?? 0;

        var points = new List<StockFlowPointDto>();
        var closing = currentTotal;
        for (var i = months - 1; i >= 0; i--)
        {
            var month = firstMonth.AddMonths(i);
            var rows = grouped.Where(g => g.Year == month.Year && g.Month == month.Month).ToList();
            points.Add(new StockFlowPointDto(
                month.Year,
                month.Month,
                month.ToString("MMM", CultureInfo.InvariantCulture),
                rows.Where(r => r.Type == StockMovementType.Inbound).Sum(r => r.In),
                rows.Where(r => r.Type == StockMovementType.Outbound).Sum(r => r.Out),
                closing));
            closing -= rows.Sum(r => r.Net);
        }
        points.Reverse();
        return points;
    }

    public async Task<IReadOnlyList<AuditLogDto>> GetAuditLogsAsync(int take, string? entity, CancellationToken ct)
    {
        var logs = db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(entity)) logs = logs.Where(a => a.EntityName == entity);

        return await logs
            .OrderByDescending(a => a.Timestamp).ThenByDescending(a => a.Id)
            .Take(Math.Clamp(take, 1, 500))
            .Select(a => new AuditLogDto(
                a.Id,
                a.UserId,
                db.Users.Where(u => u.Id == a.UserId).Select(u => u.FullName).FirstOrDefault(),
                a.Action,
                a.EntityName,
                a.EntityId,
                a.Details,
                a.Timestamp))
            .ToListAsync(ct);
    }
}
