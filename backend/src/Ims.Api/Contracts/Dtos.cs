using System.ComponentModel.DataAnnotations;
using Ims.Api.Domain;

namespace Ims.Api.Contracts;

// ---------------------------------------------------------------- shared

public enum StockStatus
{
    InStock,
    LowStock,
    OutOfStock,
}

public static class StockStatusRules
{
    public static StockStatus For(int quantity, int minimumStock) =>
        quantity <= 0 ? StockStatus.OutOfStock
        : minimumStock > 0 && quantity <= minimumStock ? StockStatus.LowStock
        : StockStatus.InStock;
}

// ---------------------------------------------------------------- auth & users

public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(200)] string Password);

public sealed record UserDto(
    int Id,
    string FullName,
    string Email,
    UserRole Role,
    IReadOnlyList<int> AssignedWarehouseIds);

public sealed record LoginResponse(string AccessToken, DateTime ExpiresAt, UserDto User);

public sealed record UserAdminDto(
    int Id,
    string FullName,
    string Email,
    UserRole Role,
    IReadOnlyList<int> AssignedWarehouseIds,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public sealed record CreateUserRequest(
    [Required, MaxLength(200)] string FullName,
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MinLength(8), MaxLength(200)] string Password,
    UserRole Role,
    IReadOnlyList<int>? AssignedWarehouseIds);

public sealed record UpdateUserRequest(
    [Required, MaxLength(200)] string FullName,
    UserRole Role,
    IReadOnlyList<int>? AssignedWarehouseIds,
    bool IsActive);

// ---------------------------------------------------------------- catalogue

public sealed record CategoryDto(int Id, string Name, string Description, int ProductCount);

public sealed record WarehouseDto(int Id, string Code, string Name, string City, decimal MapX, decimal MapY, bool IsActive);

public sealed record SupplierDto(int Id, string Name, string? ContactEmail, string? Phone, int LeadTimeDays);

public sealed record ProductDto(
    int Id,
    string Sku,
    string Name,
    string Description,
    int? CategoryId,
    string? CategoryName,
    // Null for the User role (cost data is Admin+).
    decimal? UnitPrice,
    string Units,
    int MinimumStock,
    string? Barcode,
    string? ImageUrl,
    int TotalQuantity,
    StockStatus StockStatus,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ProductUpsertRequest(
    [Required, MaxLength(64), RegularExpression("^[A-Za-z0-9._-]+$", ErrorMessage = "SKU may only contain letters, digits, '.', '_' and '-'.")]
    string Sku,
    [Required, MaxLength(200)] string Name,
    [MaxLength(2000)] string? Description,
    int? CategoryId,
    [Range(typeof(decimal), "0", "1000000000")] decimal UnitPrice,
    [Required, MaxLength(20)] string Units,
    [Range(0, int.MaxValue)] int MinimumStock,
    [MaxLength(64)] string? Barcode,
    [MaxLength(500)] string? ImageUrl);

public sealed record ProductQuery(string? Search, int? CategoryId, StockStatus? StockStatus, int? WarehouseId);

// ---------------------------------------------------------------- inventory

public sealed record WarehouseStockDto(int WarehouseId, string WarehouseCode, string WarehouseName, int Quantity, DateTime UpdatedAt);

public sealed record InventoryItemDto(
    int ProductId,
    string Sku,
    string Name,
    string Description,
    int? CategoryId,
    string? CategoryName,
    decimal? UnitPrice,
    string Units,
    int MinimumStock,
    string? Barcode,
    string? ImageUrl,
    int TotalQuantity,
    StockStatus StockStatus,
    IReadOnlyList<WarehouseStockDto> Warehouses);

public sealed record LowStockItemDto(
    int ProductId,
    string Sku,
    string Name,
    int TotalQuantity,
    int MinimumStock,
    int Shortfall,
    StockStatus StockStatus);

// ---------------------------------------------------------------- stock movements

public sealed record CreateStockMovementRequest(
    [Range(1, int.MaxValue)] int ProductId,
    [Range(1, int.MaxValue)] int WarehouseId,
    [Required] StockMovementType? Type,
    // Inbound/Outbound/Transfer: positive number of units.
    // Adjustment: signed correction (e.g. -3 after a count).
    [Range(-1_000_000, 1_000_000)] int Quantity,
    // Required for Transfer.
    int? DestinationWarehouseId,
    [MaxLength(64)] string? ReferenceNumber,
    [MaxLength(1000)] string? Notes);

public sealed record StockMovementDto(
    long Id,
    int ProductId,
    string ProductSku,
    string ProductName,
    int WarehouseId,
    string WarehouseCode,
    string WarehouseName,
    StockMovementType Type,
    int QuantityDelta,
    string? ReferenceNumber,
    string? Notes,
    int? PerformedByUserId,
    string? PerformedByName,
    DateTime CreatedAt);

public sealed record StockMovementResultDto(
    IReadOnlyList<StockMovementDto> Movements,
    IReadOnlyList<WarehouseStockDto> UpdatedStock);

public sealed record StockMovementQuery(int? ProductId, int? WarehouseId, StockMovementType? Type, int? Take);

// ---------------------------------------------------------------- purchase orders

public sealed record PurchaseOrderItemRequest(
    [Range(1, int.MaxValue)] int ProductId,
    [Range(1, 1_000_000)] int Quantity,
    [Range(typeof(decimal), "0", "1000000000")] decimal UnitCost);

public sealed record CreatePurchaseOrderRequest(
    [Range(1, int.MaxValue)] int SupplierId,
    [Range(1, int.MaxValue)] int WarehouseId,
    [Required, MinLength(1), MaxLength(200)] IReadOnlyList<PurchaseOrderItemRequest> Items,
    PurchaseOrderStatus? Status);

public sealed record PurchaseOrderItemDto(int ProductId, string Sku, string Name, int Quantity, decimal UnitCost, decimal LineTotal);

public sealed record PurchaseOrderDto(
    int Id,
    string OrderNumber,
    int SupplierId,
    string SupplierName,
    int WarehouseId,
    string WarehouseName,
    PurchaseOrderStatus Status,
    decimal TotalAmount,
    DateTime CreatedAt,
    IReadOnlyList<PurchaseOrderItemDto> Items);

// ---------------------------------------------------------------- reports & audit

public sealed record CategoryBreakdownDto(int? CategoryId, string CategoryName, int ProductCount, int Units, decimal? Value);

public sealed record InventorySummaryDto(
    int TotalItems,
    int SkuCount,
    decimal? TotalStockValue,
    int LowStockCount,
    int OutOfStockCount,
    int PendingPurchaseOrders,
    int PurchaseOrdersLast30Days,
    int ShipmentsToday,
    // Outbound movement count per day for the last 9 days (oldest first).
    IReadOnlyList<int> ShipmentsTrend,
    IReadOnlyList<CategoryBreakdownDto> CategoryBreakdown,
    IReadOnlyList<StockMovementDto> RecentActivity,
    DateTime GeneratedAt);

public sealed record StockFlowPointDto(int Year, int Month, string Label, int Inbound, int Outbound, int ClosingStock);

public sealed record AuditLogDto(
    long Id,
    int? UserId,
    string? UserName,
    string Action,
    string EntityName,
    string? EntityId,
    string? Details,
    DateTime Timestamp);
