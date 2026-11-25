using System.Net;
using System.Net.Http.Json;
using Ims.Api.Contracts;
using Ims.Api.Domain;

namespace Ims.Api.Tests;

public sealed class StockAndReportTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private async Task<(InventoryItemDto Item, WarehouseDto Warehouse)> FindStockAsync(HttpClient client, string sku, string warehouseCode)
    {
        var inventory = await client.GetFromJsonAsync<List<InventoryItemDto>>("/api/inventory", ApiFactory.Json);
        var warehouses = await client.GetFromJsonAsync<List<WarehouseDto>>("/api/warehouses", ApiFactory.Json);
        return (inventory!.Single(i => i.Sku == sku), warehouses!.Single(w => w.Code == warehouseCode));
    }

    private static int QuantityAt(InventoryItemDto item, int warehouseId) =>
        item.Warehouses.SingleOrDefault(w => w.WarehouseId == warehouseId)?.Quantity ?? 0;

    [Fact]
    public async Task Users_only_see_their_assigned_warehouses()
    {
        var user = await api.ClientForAsync(ApiFactory.User);

        var warehouses = await user.GetFromJsonAsync<List<WarehouseDto>>("/api/warehouses", ApiFactory.Json);
        Assert.Equal(["NBO", "RTM"], warehouses!.Select(w => w.Code).Order());

        var inventory = await user.GetFromJsonAsync<List<InventoryItemDto>>("/api/inventory", ApiFactory.Json);
        Assert.All(inventory!.SelectMany(i => i.Warehouses), w => Assert.Contains(w.WarehouseCode, new[] { "NBO", "RTM" }));

        var summary = await user.GetFromJsonAsync<InventorySummaryDto>("/api/reports/inventory-summary", ApiFactory.Json);
        Assert.Null(summary!.TotalStockValue);
        Assert.True(summary.TotalItems < 4358);
    }

    [Fact]
    public async Task Users_cannot_move_stock_in_warehouses_they_are_not_assigned_to()
    {
        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var (item, austin) = await FindStockAsync(admin, "CMP-SBC-8G", "AUS");

        var user = await api.ClientForAsync(ApiFactory.User);
        var response = await user.PostAsJsonAsync("/api/stock-movements",
            new CreateStockMovementRequest(item.ProductId, austin.Id, StockMovementType.Inbound, 5, null, null, null), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Outbound_beyond_available_stock_is_rejected_and_changes_nothing()
    {
        var user = await api.ClientForAsync(ApiFactory.User);
        var (item, nairobi) = await FindStockAsync(user, "SNS-CAM-5MP", "NBO");
        var before = QuantityAt(item, nairobi.Id);

        var response = await user.PostAsJsonAsync("/api/stock-movements",
            new CreateStockMovementRequest(item.ProductId, nairobi.Id, StockMovementType.Outbound, before + 1, null, "SO-TEST", null), ApiFactory.Json);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("Insufficient stock", problem);
        Assert.Contains($"\"available\":{before}", problem);

        var (after, _) = await FindStockAsync(user, "SNS-CAM-5MP", "NBO");
        Assert.Equal(before, QuantityAt(after, nairobi.Id));
    }

    [Fact]
    public async Task Inbound_and_outbound_update_stock_and_write_movements_and_audit()
    {
        var user = await api.ClientForAsync(ApiFactory.User);
        var (item, rotterdam) = await FindStockAsync(user, "CBL-CAT6-2M", "RTM");
        var start = QuantityAt(item, rotterdam.Id);

        var inbound = await user.PostAsJsonAsync("/api/stock-movements",
            new CreateStockMovementRequest(item.ProductId, rotterdam.Id, StockMovementType.Inbound, 40, null, "GRN-TEST-1", "Delivery"), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.Created, inbound.StatusCode);
        var inboundResult = (await inbound.Content.ReadFromJsonAsync<StockMovementResultDto>(ApiFactory.Json))!;
        Assert.Equal(start + 40, inboundResult.UpdatedStock.Single().Quantity);
        Assert.Equal(40, inboundResult.Movements.Single().QuantityDelta);
        Assert.Equal("Daniel Okoye", inboundResult.Movements.Single().PerformedByName);

        var outbound = await user.PostAsJsonAsync("/api/stock-movements",
            new CreateStockMovementRequest(item.ProductId, rotterdam.Id, StockMovementType.Outbound, 15, null, "SO-TEST-1", null), ApiFactory.Json);
        var outboundResult = (await outbound.Content.ReadFromJsonAsync<StockMovementResultDto>(ApiFactory.Json))!;
        Assert.Equal(start + 25, outboundResult.UpdatedStock.Single().Quantity);
        Assert.Equal(-15, outboundResult.Movements.Single().QuantityDelta);

        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var audit = await admin.GetFromJsonAsync<List<AuditLogDto>>("/api/audit-logs?entity=StockMovement", ApiFactory.Json);
        Assert.Contains(audit!, a => a.Action == "StockMovement.Inbound" && a.UserName == "Daniel Okoye");
        Assert.Contains(audit!, a => a.Action == "StockMovement.Outbound");
    }

    [Fact]
    public async Task Transfers_move_stock_between_warehouses_atomically()
    {
        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var (item, singapore) = await FindStockAsync(admin, "DSP-7IPS-TCH", "SIN");
        var (_, saoPaulo) = await FindStockAsync(admin, "DSP-7IPS-TCH", "GRU");
        var total = item.TotalQuantity;

        var response = await admin.PostAsJsonAsync("/api/stock-movements",
            new CreateStockMovementRequest(item.ProductId, singapore.Id, StockMovementType.Transfer, 10, saoPaulo.Id, "TR-TEST-1", null), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = (await response.Content.ReadFromJsonAsync<StockMovementResultDto>(ApiFactory.Json))!;

        Assert.Equal([-10, 10], result.Movements.Select(m => m.QuantityDelta));
        Assert.Equal(QuantityAt(item, singapore.Id) - 10, result.UpdatedStock.Single(s => s.WarehouseId == singapore.Id).Quantity);
        Assert.Equal(QuantityAt(item, saoPaulo.Id) + 10, result.UpdatedStock.Single(s => s.WarehouseId == saoPaulo.Id).Quantity);

        var (after, _) = await FindStockAsync(admin, "DSP-7IPS-TCH", "SIN");
        Assert.Equal(total, after.TotalQuantity);
    }

    [Theory]
    [InlineData(StockMovementType.Inbound, 0, null)]
    [InlineData(StockMovementType.Outbound, -5, null)]
    [InlineData(StockMovementType.Transfer, 5, null)]
    public async Task Invalid_movements_are_rejected(StockMovementType type, int quantity, int? destination)
    {
        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var (item, warehouse) = await FindStockAsync(admin, "PWR-18650-35", "GRU");
        var response = await admin.PostAsJsonAsync("/api/stock-movements",
            new CreateStockMovementRequest(item.ProductId, warehouse.Id, type, quantity, destination, null, null), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Stock_flow_covers_twelve_months_and_ends_at_current_stock()
    {
        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var flow = await admin.GetFromJsonAsync<List<StockFlowPointDto>>("/api/reports/stock-flow", ApiFactory.Json);
        var inventory = await admin.GetFromJsonAsync<List<InventoryItemDto>>("/api/inventory", ApiFactory.Json);

        Assert.Equal(12, flow!.Count);
        Assert.Equal(inventory!.Sum(i => i.TotalQuantity), flow[^1].ClosingStock);
        Assert.Contains(flow, p => p.Inbound > 0 && p.Outbound > 0);
    }

    [Fact]
    public async Task Admins_create_purchase_orders_users_cannot()
    {
        var user = await api.ClientForAsync(ApiFactory.User);
        var request = new CreatePurchaseOrderRequest(1, 1, [new PurchaseOrderItemRequest(1, 10, 5m)], null);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsJsonAsync("/api/purchase-orders", request, ApiFactory.Json)).StatusCode);

        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var suppliers = await admin.GetFromJsonAsync<List<SupplierDto>>("/api/suppliers", ApiFactory.Json);
        var warehouses = await admin.GetFromJsonAsync<List<WarehouseDto>>("/api/warehouses", ApiFactory.Json);
        var products = await admin.GetFromJsonAsync<List<ProductDto>>("/api/products", ApiFactory.Json);

        var response = await admin.PostAsJsonAsync("/api/purchase-orders",
            new CreatePurchaseOrderRequest(suppliers![0].Id, warehouses![0].Id,
                [new PurchaseOrderItemRequest(products![0].Id, 10, 5m), new PurchaseOrderItemRequest(products[1].Id, 2, 2.5m)], null),
            ApiFactory.Json);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var order = (await response.Content.ReadFromJsonAsync<PurchaseOrderDto>(ApiFactory.Json))!;
        Assert.Equal(55m, order.TotalAmount);
        Assert.Equal(PurchaseOrderStatus.Submitted, order.Status);
        Assert.StartsWith("PO-", order.OrderNumber);
    }

    [Fact]
    public async Task Health_endpoint_reports_healthy()
    {
        var response = await api.CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
