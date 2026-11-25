namespace Ims.Api.Domain;

/// <summary>Application roles, lowest to highest privilege.</summary>
public enum UserRole
{
    User = 0,
    Admin = 1,
    SuperAdmin = 2,
}

public enum StockMovementType
{
    /// <summary>Goods received into a warehouse (quantity added).</summary>
    Inbound = 0,

    /// <summary>Goods leaving a warehouse, e.g. a sale or shipment (quantity removed).</summary>
    Outbound = 1,

    /// <summary>Correction after a count; signed delta.</summary>
    Adjustment = 2,

    /// <summary>Move between two warehouses (recorded as an out-leg and an in-leg).</summary>
    Transfer = 3,
}

public enum PurchaseOrderStatus
{
    Draft = 0,
    Submitted = 1,
    Received = 2,
    Cancelled = 3,
}
