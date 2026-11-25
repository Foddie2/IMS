using System.Net.Http.Json;
using Ims.Api.Contracts;

namespace Ims.Api.Tests;

/// <summary>Read-only checks on a pristine seeded database (own fixture, nothing else mutates it).</summary>
public sealed class SeedDataTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Seeded_totals_match_the_expected_demo_inventory()
    {
        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var summary = await admin.GetFromJsonAsync<InventorySummaryDto>("/api/reports/inventory-summary", ApiFactory.Json);

        Assert.Equal(4358, summary!.TotalItems);
        Assert.Equal(12, summary.SkuCount);
        Assert.Equal(2, summary.OutOfStockCount);
        Assert.NotNull(summary.TotalStockValue);
        Assert.Equal(3, summary.PendingPurchaseOrders);
        Assert.Equal(9, summary.ShipmentsTrend.Count);
        Assert.NotEmpty(summary.RecentActivity);
    }
}
