using Ims.Api.Auth;
using Ims.Api.Contracts;
using Ims.Api.Data;
using Ims.Api.Domain;
using Ims.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Controllers;

[ApiController]
[Route("api/products")]
[Authorize(Roles = Roles.AnyUser)]
[Produces("application/json")]
public sealed class ProductsController(ProductService products) : ControllerBase
{
    /// <summary>Active products with stock totals for your warehouses. Filters: search (name/SKU), categoryId, stockStatus, warehouseId.</summary>
    [HttpGet]
    public Task<IReadOnlyList<ProductDto>> List([FromQuery] ProductQuery query, CancellationToken ct) =>
        products.ListAsync(query, ct);

    [HttpGet("{id:int}")]
    public Task<ProductDto> Get(int id, CancellationToken ct) => products.GetAsync(id, ct);

    [HttpPost]
    [Authorize(Roles = Roles.AdminOrAbove)]
    [ProducesResponseType<ProductDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductDto>> Create(ProductUpsertRequest request, CancellationToken ct)
    {
        var created = await products.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.AdminOrAbove)]
    public Task<ProductDto> Update(int id, ProductUpsertRequest request, CancellationToken ct) =>
        products.UpdateAsync(id, request, ct);

    /// <summary>Soft-deletes the product (history is kept). SuperAdmin only.</summary>
    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.SuperAdminOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await products.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/categories")]
[Authorize(Roles = Roles.AnyUser)]
[Produces("application/json")]
public sealed class CategoriesController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<CategoryDto>> List(CancellationToken ct) =>
        await db.Categories.AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Description, c.Products.Count(p => p.IsActive)))
            .ToListAsync(ct);
}

[ApiController]
[Route("api/warehouses")]
[Authorize(Roles = Roles.AnyUser)]
[Produces("application/json")]
public sealed class WarehousesController(ApplicationDbContext db, ICurrentUser current) : ControllerBase
{
    /// <summary>Warehouses you can access (all of them for Admin/SuperAdmin).</summary>
    [HttpGet]
    public async Task<IReadOnlyList<WarehouseDto>> List(CancellationToken ct)
    {
        var scope = (await current.GetAccessibleWarehouseIdsAsync(ct))?.ToArray();
        return await db.Warehouses.AsNoTracking().InScope(scope)
            .OrderBy(w => w.Name)
            .Select(w => new WarehouseDto(w.Id, w.Code, w.Name, w.City, w.MapX, w.MapY, w.IsActive))
            .ToListAsync(ct);
    }
}

[ApiController]
[Route("api/inventory")]
[Authorize(Roles = Roles.AnyUser)]
[Produces("application/json")]
public sealed class InventoryController(InventoryService inventory, ICurrentUser current) : ControllerBase
{
    /// <summary>Stock per product: total for your warehouses plus the per-warehouse breakdown.</summary>
    [HttpGet]
    public async Task<IReadOnlyList<InventoryItemDto>> List(
        [FromQuery] string? search, [FromQuery] int? categoryId, [FromQuery] int? warehouseId, CancellationToken ct)
    {
        if (warehouseId is { } wid) await current.EnsureWarehouseAccessAsync(wid, ct);
        return await inventory.GetAsync(search, categoryId, warehouseId, ct);
    }

    /// <summary>Products at or below their minimum stock, worst first.</summary>
    [HttpGet("low-stock")]
    public async Task<IReadOnlyList<LowStockItemDto>> LowStock([FromQuery] int? warehouseId, CancellationToken ct)
    {
        if (warehouseId is { } wid) await current.EnsureWarehouseAccessAsync(wid, ct);
        return await inventory.GetLowStockAsync(warehouseId, ct);
    }
}

[ApiController]
[Route("api/suppliers")]
[Authorize(Roles = Roles.AnyUser)]
[Produces("application/json")]
public sealed class SuppliersController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<SupplierDto>> List(CancellationToken ct) =>
        await db.Suppliers.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto(s.Id, s.Name, s.ContactEmail, s.Phone, s.LeadTimeDays))
            .ToListAsync(ct);
}

[ApiController]
[Route("api/purchase-orders")]
[Authorize(Roles = Roles.AdminOrAbove)]
[Produces("application/json")]
public sealed class PurchaseOrdersController(PurchaseOrderService orders) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<PurchaseOrderDto>> List([FromQuery] PurchaseOrderStatus? status, CancellationToken ct) =>
        orders.ListAsync(status, ct);

    [HttpPost]
    [ProducesResponseType<PurchaseOrderDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<PurchaseOrderDto>> Create(CreatePurchaseOrderRequest request, CancellationToken ct)
    {
        var created = await orders.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }
}

[ApiController]
[Route("api/reports")]
[Authorize(Roles = Roles.AnyUser)]
[Produces("application/json")]
public sealed class ReportsController(ReportService reports) : ControllerBase
{
    /// <summary>
    /// Totals, low/out-of-stock counts, category breakdown and recent activity for your warehouses.
    /// Stock value is only included for Admin and SuperAdmin.
    /// </summary>
    [HttpGet("inventory-summary")]
    public Task<InventorySummaryDto> InventorySummary([FromQuery] int? warehouseId, CancellationToken ct) =>
        reports.GetInventorySummaryAsync(warehouseId, ct);

    /// <summary>Monthly inbound/outbound units and closing stock (default: last 12 months).</summary>
    [HttpGet("stock-flow")]
    public Task<IReadOnlyList<StockFlowPointDto>> StockFlow(
        [FromQuery] int months = 12, [FromQuery] int? warehouseId = null, CancellationToken ct = default) =>
        reports.GetStockFlowAsync(months, warehouseId, ct);
}

[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = Roles.AdminOrAbove)]
[Produces("application/json")]
public sealed class AuditLogsController(ReportService reports) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<AuditLogDto>> List([FromQuery] int take = 100, [FromQuery] string? entity = null, CancellationToken ct = default) =>
        reports.GetAuditLogsAsync(take, entity, ct);
}

[ApiController]
[Route("api/users")]
[Authorize(Roles = Roles.SuperAdminOnly)]
[Produces("application/json")]
public sealed class UsersController(UserService users) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<UserAdminDto>> List(CancellationToken ct) => users.ListAsync(ct);

    [HttpPost]
    [ProducesResponseType<UserAdminDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<UserAdminDto>> Create(CreateUserRequest request, CancellationToken ct)
    {
        var created = await users.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>Change name, role, warehouse assignments or deactivate. The last SuperAdmin cannot be demoted.</summary>
    [HttpPut("{id:int}")]
    public Task<UserAdminDto> Update(int id, UpdateUserRequest request, CancellationToken ct) =>
        users.UpdateAsync(id, request, ct);
}
