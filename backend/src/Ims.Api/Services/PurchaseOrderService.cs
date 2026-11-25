using System.Security.Cryptography;
using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Ims.Api.Domain;
using Ims.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Services;

public sealed class PurchaseOrderService(ApplicationDbContext db, ICurrentUser current, AuditLogger audit, TimeProvider clock)
{
    public async Task<IReadOnlyList<PurchaseOrderDto>> ListAsync(PurchaseOrderStatus? status, CancellationToken ct)
    {
        var orders = db.PurchaseOrders.AsNoTracking();
        if (status is not null) orders = orders.Where(o => o.Status == status);

        return await orders
            .OrderByDescending(o => o.CreatedAt)
            .Take(200)
            .Select(o => new PurchaseOrderDto(
                o.Id, o.OrderNumber, o.SupplierId, o.Supplier.Name, o.WarehouseId, o.Warehouse.Name,
                o.Status, o.TotalAmount, o.CreatedAt,
                o.Items.OrderBy(i => i.Id)
                    .Select(i => new PurchaseOrderItemDto(i.ProductId, i.Product.Sku, i.Product.Name, i.Quantity, i.UnitCost, i.Quantity * i.UnitCost))
                    .ToList()))
            .ToListAsync(ct);
    }

    public async Task<PurchaseOrderDto> CreateAsync(CreatePurchaseOrderRequest request, CancellationToken ct)
    {
        var status = request.Status ?? PurchaseOrderStatus.Submitted;
        if (status is not (PurchaseOrderStatus.Draft or PurchaseOrderStatus.Submitted))
        {
            throw new BusinessValidationException("New purchase orders must be Draft or Submitted.");
        }
        if (!await db.Suppliers.AnyAsync(s => s.Id == request.SupplierId, ct))
        {
            throw new BusinessValidationException($"Supplier {request.SupplierId} does not exist.");
        }
        if (!await db.Warehouses.AnyAsync(w => w.Id == request.WarehouseId && w.IsActive, ct))
        {
            throw new BusinessValidationException($"Warehouse {request.WarehouseId} does not exist or is inactive.");
        }

        var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        if (productIds.Count != request.Items.Count)
        {
            throw new BusinessValidationException("Each product may appear only once per purchase order.");
        }
        var known = await db.Products.Where(p => productIds.Contains(p.Id) && p.IsActive).Select(p => p.Id).ToListAsync(ct);
        var unknown = productIds.Except(known).ToList();
        if (unknown.Count > 0)
        {
            throw new BusinessValidationException($"Unknown or inactive product id(s): {string.Join(", ", unknown)}.");
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var order = new PurchaseOrder
        {
            OrderNumber = $"PO-{now:yyMMdd}-{RandomNumberGenerator.GetInt32(1000, 9999)}",
            SupplierId = request.SupplierId,
            WarehouseId = request.WarehouseId,
            Status = status,
            CreatedByUserId = current.Id,
            CreatedAt = now,
            Items = request.Items.Select(i => new PurchaseOrderItem
            {
                ProductId = i.ProductId,
                Quantity = i.Quantity,
                UnitCost = i.UnitCost,
            }).ToList(),
        };
        order.TotalAmount = order.Items.Sum(i => i.Quantity * i.UnitCost);

        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync(ct);
        audit.Record(current.Id, "Create", nameof(PurchaseOrder), order.Id, new
        {
            order.OrderNumber,
            Status = order.Status.ToString(),
            order.TotalAmount,
            lines = order.Items.Count,
        });
        await db.SaveChangesAsync(ct);

        return (await ListAsync(null, ct)).First(o => o.Id == order.Id);
    }
}
