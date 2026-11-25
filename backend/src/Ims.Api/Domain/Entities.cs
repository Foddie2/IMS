namespace Ims.Api.Domain;

public class User
{
    public int Id { get; set; }
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public UserRole Role { get; set; } = UserRole.User;

    /// <summary>Warehouses a <see cref="UserRole.User"/> may access. Admins and SuperAdmins see all.</summary>
    public List<int> AssignedWarehouseIds { get; set; } = [];

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class Category
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";

    public List<Product> Products { get; set; } = [];
}

public class Warehouse
{
    public int Id { get; set; }

    /// <summary>Short unique code, e.g. "RTM".</summary>
    public required string Code { get; set; }
    public required string Name { get; set; }
    public string City { get; set; } = "";

    /// <summary>Pin position on the dashboard map, as a percentage (0–100).</summary>
    public decimal MapX { get; set; }
    public decimal MapY { get; set; }
    public bool IsActive { get; set; } = true;

    public List<WarehouseInventory> Inventory { get; set; } = [];
}

public class Product
{
    public int Id { get; set; }
    public required string Sku { get; set; }
    public required string Name { get; set; }
    public string Description { get; set; } = "";
    public int? CategoryId { get; set; }
    public Category? Category { get; set; }
    public decimal UnitPrice { get; set; }
    public string Units { get; set; } = "pcs";

    /// <summary>Re-order point: at or below this total quantity the product is "low stock".</summary>
    public int MinimumStock { get; set; }
    public string? Barcode { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<WarehouseInventory> Inventory { get; set; } = [];
}

/// <summary>Quantity on hand of one product in one warehouse.</summary>
public class WarehouseInventory
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public int Quantity { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>Optimistic concurrency token (PostgreSQL <c>xmin</c>).</summary>
    public uint Version { get; set; }
}

public class StockMovement
{
    public long Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public StockMovementType Type { get; set; }

    /// <summary>Signed change applied to the warehouse quantity.</summary>
    public int QuantityDelta { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public int? PerformedByUserId { get; set; }
    public User? PerformedByUser { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Supplier
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? ContactEmail { get; set; }
    public string? Phone { get; set; }
    public int LeadTimeDays { get; set; }
}

public class PurchaseOrder
{
    public int Id { get; set; }
    public required string OrderNumber { get; set; }
    public int SupplierId { get; set; }
    public Supplier Supplier { get; set; } = null!;
    public int WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Submitted;
    public decimal TotalAmount { get; set; }
    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<PurchaseOrderItem> Items { get; set; } = [];
}

public class PurchaseOrderItem
{
    public int Id { get; set; }
    public int PurchaseOrderId { get; set; }
    public PurchaseOrder PurchaseOrder { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
}

public class AuditLog
{
    public long Id { get; set; }
    public int? UserId { get; set; }
    public required string Action { get; set; }
    public required string EntityName { get; set; }
    public string? EntityId { get; set; }

    /// <summary>JSON document with the relevant before/after values.</summary>
    public string? Details { get; set; }
    public DateTime Timestamp { get; set; }
}
