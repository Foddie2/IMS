using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Ims.Api.Domain;
using Ims.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Services;

public sealed class ProductService(ApplicationDbContext db, ICurrentUser current, AuditLogger audit, TimeProvider clock)
{
    public async Task<IReadOnlyList<ProductDto>> ListAsync(ProductQuery query, CancellationToken ct)
    {
        if (query.WarehouseId is { } wid) await current.EnsureWarehouseAccessAsync(wid, ct);
        var scope = Projections.Narrow((await current.GetAccessibleWarehouseIdsAsync(ct))?.ToArray(), query.WarehouseId);

        var products = db.Products.AsNoTracking().Where(p => p.IsActive);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            products = products.Where(p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term));
        }
        if (query.CategoryId is not null)
        {
            products = products.Where(p => p.CategoryId == query.CategoryId);
        }

        var items = await Project(products.OrderBy(p => p.Name), scope).ToListAsync(ct);
        return items
            .Select(Finish)
            .Where(p => query.StockStatus is null || p.StockStatus == query.StockStatus)
            .ToList();
    }

    public async Task<ProductDto> GetAsync(int id, CancellationToken ct)
    {
        var scope = (await current.GetAccessibleWarehouseIdsAsync(ct))?.ToArray();
        var row = await Project(db.Products.AsNoTracking().Where(p => p.Id == id && p.IsActive), scope)
            .SingleOrDefaultAsync(ct) ?? throw new NotFoundException($"Product {id} not found.");
        return Finish(row);
    }

    public async Task<ProductDto> CreateAsync(ProductUpsertRequest request, CancellationToken ct)
    {
        var sku = request.Sku.Trim().ToUpperInvariant();
        if (await db.Products.AnyAsync(p => p.Sku == sku, ct))
        {
            throw new ConflictException($"SKU {sku} is already in use.");
        }
        await EnsureCategoryAsync(request.CategoryId, ct);

        var now = clock.GetUtcNow().UtcDateTime;
        var product = new Product
        {
            Sku = sku,
            Name = request.Name.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
        };
        Apply(product, request);
        db.Products.Add(product);
        await db.SaveChangesAsync(ct);

        audit.Record(current.Id, "Create", nameof(Product), product.Id, new { product.Sku, product.Name });
        await db.SaveChangesAsync(ct);
        return await GetAsync(product.Id, ct);
    }

    public async Task<ProductDto> UpdateAsync(int id, ProductUpsertRequest request, CancellationToken ct)
    {
        var product = await db.Products.SingleOrDefaultAsync(p => p.Id == id && p.IsActive, ct)
            ?? throw new NotFoundException($"Product {id} not found.");

        var sku = request.Sku.Trim().ToUpperInvariant();
        if (sku != product.Sku && await db.Products.AnyAsync(p => p.Sku == sku && p.Id != id, ct))
        {
            throw new ConflictException($"SKU {sku} is already in use.");
        }
        await EnsureCategoryAsync(request.CategoryId, ct);

        var before = new { product.Sku, product.Name, product.UnitPrice, product.MinimumStock, product.CategoryId };
        product.Sku = sku;
        Apply(product, request);
        product.UpdatedAt = clock.GetUtcNow().UtcDateTime;

        audit.Record(current.Id, "Update", nameof(Product), product.Id, new
        {
            before,
            after = new { product.Sku, product.Name, product.UnitPrice, product.MinimumStock, product.CategoryId },
        });
        await db.SaveChangesAsync(ct);
        return await GetAsync(product.Id, ct);
    }

    /// <summary>
    /// Soft delete: the product disappears from the catalogue but its stock movements,
    /// purchase orders and audit history stay intact.
    /// </summary>
    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var product = await db.Products.SingleOrDefaultAsync(p => p.Id == id && p.IsActive, ct)
            ?? throw new NotFoundException($"Product {id} not found.");

        product.IsActive = false;
        product.UpdatedAt = clock.GetUtcNow().UtcDateTime;
        audit.Record(current.Id, "Delete", nameof(Product), product.Id, new { product.Sku, product.Name });
        await db.SaveChangesAsync(ct);
    }

    private sealed record Row(Product P, string? CategoryName, int Quantity);

    private static IQueryable<Row> Project(IQueryable<Product> products, int[]? scope)
    {
        var inScope = Projections.InventoryInScope(scope);
        return products.Select(p => new Row(
            p,
            p.Category != null ? p.Category.Name : null,
            p.Inventory.AsQueryable().Where(inScope).Sum(i => (int?)i.Quantity) ?? 0));
    }

    private ProductDto Finish(Row r) => new(
        r.P.Id, r.P.Sku, r.P.Name, r.P.Description, r.P.CategoryId, r.CategoryName,
        current.IsAdminOrAbove ? r.P.UnitPrice : null,
        r.P.Units, r.P.MinimumStock, r.P.Barcode, r.P.ImageUrl,
        r.Quantity, StockStatusRules.For(r.Quantity, r.P.MinimumStock),
        r.P.CreatedAt, r.P.UpdatedAt);

    private static void Apply(Product product, ProductUpsertRequest request)
    {
        product.Name = request.Name.Trim();
        product.Description = request.Description?.Trim() ?? "";
        product.CategoryId = request.CategoryId;
        product.UnitPrice = request.UnitPrice;
        product.Units = request.Units.Trim();
        product.MinimumStock = request.MinimumStock;
        product.Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
        product.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
    }

    private async Task EnsureCategoryAsync(int? categoryId, CancellationToken ct)
    {
        if (categoryId is not null && !await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
        {
            throw new BusinessValidationException($"Category {categoryId} does not exist.");
        }
    }
}
