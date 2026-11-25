using Ims.Api.Domain;
using Ims.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Data;

public sealed class DatabaseOptions
{
    public const string Section = "Database";

    /// <summary>Apply pending EF Core migrations when the API starts.</summary>
    public bool ApplyMigrationsOnStartup { get; set; } = true;

    /// <summary>Seed demo warehouses, products, stock history and the three demo logins into an empty database.</summary>
    public bool SeedDemoData { get; set; } = true;

    /// <summary>
    /// Run on a throw-away in-memory database instead of PostgreSQL (data is lost on restart).
    /// For trying the app without a database only – never in production.
    /// </summary>
    public bool UseInMemoryDemo { get; set; }
}

/// <summary>Migrates the database and seeds demo data when it is empty. Safe to run on every start.</summary>
public static class DbInitializer
{
    public static readonly (string Email, string Password, UserRole Role, string Name)[] DemoAccounts =
    [
        ("admin@ims.com", "Admin123!", UserRole.SuperAdmin, "Alex Morgan"),
        ("manager@ims.com", "Manager123!", UserRole.Admin, "Priya Raman"),
        ("operator@ims.com", "Operator123!", UserRole.User, "Daniel Okoye"),
    ];

    public static async Task InitializeAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var options = scope.ServiceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<DatabaseOptions>>().Value;
        var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DbInitializer));

        if (db.Database.IsRelational())
        {
            if (options.ApplyMigrationsOnStartup)
            {
                await db.Database.MigrateAsync(ct);
            }
        }
        else
        {
            await db.Database.EnsureCreatedAsync(ct);
        }

        if (!options.SeedDemoData) return;

        var now = clock.GetUtcNow().UtcDateTime;
        if (!await db.Warehouses.AnyAsync(ct))
        {
            logger.LogInformation("Empty database: seeding demo catalogue, stock and history.");
            await SeedCatalogueAsync(db, now, ct);
        }
        if (!await db.Users.AnyAsync(ct))
        {
            logger.LogWarning("Seeding demo logins (admin@ims.com etc.). Change these passwords before going live.");
            await SeedUsersAsync(db, now, ct);
        }
    }

    private static async Task SeedUsersAsync(ApplicationDbContext db, DateTime now, CancellationToken ct)
    {
        var operatorWarehouses = await db.Warehouses
            .Where(w => w.Code == "RTM" || w.Code == "NBO")
            .Select(w => w.Id)
            .ToListAsync(ct);

        foreach (var (email, password, role, name) in DemoAccounts)
        {
            db.Users.Add(new User
            {
                FullName = name,
                Email = email,
                PasswordHash = AuthService.HashPassword(password),
                Role = role,
                AssignedWarehouseIds = role == UserRole.User ? operatorWarehouses : [],
                CreatedAt = now,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedCatalogueAsync(ApplicationDbContext db, DateTime now, CancellationToken ct)
    {
        // Pins use an equirectangular projection: x = (lon+180)/360, y = (90-lat)/180.
        var warehouses = new[]
        {
            new Warehouse { Code = "RTM", Name = "Rotterdam DC", City = "Rotterdam, NL", MapX = 51.3m, MapY = 21.2m },
            new Warehouse { Code = "AUS", Name = "Austin Hub", City = "Austin, US", MapX = 22.9m, MapY = 33.2m },
            new Warehouse { Code = "SIN", Name = "Singapore DC", City = "Singapore, SG", MapX = 78.8m, MapY = 49.2m },
            new Warehouse { Code = "NBO", Name = "Nairobi Hub", City = "Nairobi, KE", MapX = 60.2m, MapY = 50.7m },
            new Warehouse { Code = "GRU", Name = "São Paulo DC", City = "São Paulo, BR", MapX = 37.1m, MapY = 63.1m },
        };
        db.Warehouses.AddRange(warehouses);

        var categories = new[]
        {
            "Compute Modules", "Sensors", "Storage", "Cables & Connectors",
            "Networking", "Displays", "Power", "Peripherals",
        }.ToDictionary(n => n, n => new Category { Name = n });
        db.Categories.AddRange(categories.Values);

        db.Suppliers.AddRange(
            new Supplier { Name = "Nordic Components AB", ContactEmail = "orders@nordic-components.example", Phone = "+46 8 555 0100", LeadTimeDays = 7 },
            new Supplier { Name = "Pacific Silicon Ltd", ContactEmail = "sales@pacificsilicon.example", Phone = "+65 6555 0199", LeadTimeDays = 14 },
            new Supplier { Name = "Andes Power Systems", ContactEmail = "comercial@andespower.example", Phone = "+55 11 5555 0123", LeadTimeDays = 10 },
            new Supplier { Name = "Lakeside Cable Co.", ContactEmail = "hello@lakesidecable.example", Phone = "+1 512 555 0147", LeadTimeDays = 5 });

        // (sku, name, description, category, price, min, barcode, image, target stock per warehouse code)
        var catalogue = new (string Sku, string Name, string Desc, string Cat, decimal Price, int Min, string Barcode, string Image, (string Wh, int Qty)[] Stock)[]
        {
            ("CMP-ESP32-S3", "ESP32-S3 Dev Board", "Dual-core Wi-Fi + BLE microcontroller board, 8 MB PSRAM.", "Compute Modules", 8.90m, 200, "7350012400011", "microcontroller", [("RTM", 744), ("AUS", 310), ("SIN", 186)]),
            ("CMP-SBC-8G", "Single-Board Computer 8 GB", "Quad-core ARM SBC, 8 GB LPDDR4X, dual 4K output.", "Compute Modules", 80m, 100, "7350012400028", "sbc", [("AUS", 53), ("SIN", 21), ("NBO", 12)]),
            ("SNS-BME280", "BME280 Environmental Sensor", "Temperature, humidity and pressure sensor breakout.", "Sensors", 4.75m, 150, "7350012400035", "sensor", [("SIN", 386), ("NBO", 160), ("GRU", 96)]),
            ("STO-NVME-1T", "NVMe SSD 1 TB Gen4", "M.2 2280 PCIe 4.0 solid-state drive, 7,000 MB/s read.", "Storage", 109m, 40, "7350012400042", "ssd", [("RTM", 0)]),
            ("CBL-USBC-1M", "USB-C to USB-C Cable 1 m", "100 W PD, USB 3.2 Gen 2 braided cable.", "Cables & Connectors", 3.20m, 300, "7350012400059", "cable", [("NBO", 588), ("GRU", 245), ("RTM", 147)]),
            ("NET-AX3000", "Wi-Fi 6 Dual-Band Router", "AX3000 router with 4× gigabit LAN and WPA3.", "Networking", 79.99m, 40, "7350012400066", "router", [("AUS", 15), ("SIN", 6), ("NBO", 3)]),
            ("DSP-7IPS-TCH", "7\" IPS Touch Display", "1024×600 capacitive touchscreen with HDMI input.", "Displays", 42.50m, 50, "7350012400073", "display", [("SIN", 80), ("NBO", 33), ("GRU", 19)]),
            ("PWR-18650-35", "18650 Li-ion Cell 3500 mAh", "High-capacity rechargeable cell, 10 A continuous.", "Power", 5.40m, 400, "7350012400080", "battery", [("GRU", 672), ("RTM", 280), ("AUS", 168)]),
            ("PWR-PSU-12V5A", "12 V 5 A Switching PSU", "Enclosed 60 W power supply, universal AC input.", "Power", 18.60m, 60, "7350012400097", "psu", [("RTM", 0)]),
            ("PER-KB-WLM", "Wireless Mechanical Keyboard", "Low-profile tactile switches, Bluetooth + 2.4 GHz.", "Peripherals", 99.99m, 30, "7350012400103", "keyboard", [("AUS", 36), ("SIN", 14), ("NBO", 8)]),
            ("SNS-CAM-5MP", "5 MP Camera Module", "OV5647 sensor, 15-pin MIPI CSI ribbon included.", "Sensors", 12.30m, 25, "7350012400110", "camera", [("SIN", 12), ("NBO", 4), ("GRU", 2)]),
            ("CBL-CAT6-2M", "Cat6 Patch Cable 2 m", "Snagless RJ45, 550 MHz, LSZH jacket.", "Cables & Connectors", 2.10m, 100, "7350012400127", "cable", [("NBO", 36), ("GRU", 14), ("RTM", 8)]),
        };

        var products = catalogue.Select(c => new Product
        {
            Sku = c.Sku,
            Name = c.Name,
            Description = c.Desc,
            Category = categories[c.Cat],
            UnitPrice = c.Price,
            MinimumStock = c.Min,
            Barcode = c.Barcode,
            ImageUrl = $"/images/products/{c.Image}.svg",
            CreatedAt = now.AddMonths(-13),
            UpdatedAt = now.AddMonths(-13),
        }).ToList();
        db.Products.AddRange(products);
        await db.SaveChangesAsync(ct);

        var byCode = warehouses.ToDictionary(w => w.Code);
        var random = new Random(42);
        for (var p = 0; p < catalogue.Length; p++)
        {
            foreach (var (code, target) in catalogue[p].Stock)
            {
                SeedHistory(db, products[p], byCode[code], target, now, random);
            }
        }

        var suppliers = await db.Suppliers.OrderBy(s => s.Id).ToListAsync(ct);
        db.PurchaseOrders.AddRange(
            NewOrder("PO-SEED-0001", suppliers[1], byCode["RTM"], PurchaseOrderStatus.Submitted, now.AddDays(-2), (products[3], 120, 92m)),
            NewOrder("PO-SEED-0002", suppliers[2], byCode["RTM"], PurchaseOrderStatus.Submitted, now.AddDays(-1), (products[8], 150, 14.20m)),
            NewOrder("PO-SEED-0003", suppliers[0], byCode["AUS"], PurchaseOrderStatus.Submitted, now.AddHours(-5), (products[1], 80, 68m), (products[5], 50, 61m)),
            NewOrder("PO-SEED-0004", suppliers[3], byCode["NBO"], PurchaseOrderStatus.Received, now.AddDays(-9), (products[4], 1200, 2.10m)));

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Twelve months of plausible inbound/outbound movements that end exactly at <paramref name="target"/>,
    /// never dipping below zero, so charts and the stock-flow report have real data to aggregate.
    /// </summary>
    private static void SeedHistory(ApplicationDbContext db, Product product, Warehouse warehouse, int target, DateTime now, Random random)
    {
        var size = Math.Max(10, target / 3 + 20);
        var balance = target + random.Next(50, 200);
        Add(StockMovementType.Inbound, balance, now.AddMonths(-12), "Opening balance");

        for (var month = -11; month <= -1; month++)
        {
            var date = now.AddMonths(month).AddDays(-random.Next(0, 20));
            var inbound = random.Next(size / 2, size * 2);
            balance += inbound;
            Add(StockMovementType.Inbound, inbound, date, null);

            // Pull the balance back towards the target so the final reconciliation stays small
            // (otherwise the random walk drifts and the last month shows an artificial spike).
            var drift = (balance - (target + size)) / 2;
            var outbound = Math.Clamp(random.Next(size / 2, size * 2) + drift, 0, balance);
            if (outbound > 0)
            {
                balance -= outbound;
                Add(StockMovementType.Outbound, -outbound, date.AddDays(random.Next(1, 8)), null);
            }
        }

        // This week's activity, then reconcile to the target.
        var difference = target - balance;
        if (difference != 0)
        {
            var type = difference > 0 ? StockMovementType.Inbound : StockMovementType.Outbound;
            Add(type, difference, now.AddDays(-random.Next(0, 5)).AddHours(-random.Next(1, 20)), null);
        }

        db.Inventory.Add(new WarehouseInventory
        {
            Product = product,
            Warehouse = warehouse,
            Quantity = target,
            UpdatedAt = now,
        });

        void Add(StockMovementType type, int delta, DateTime at, string? notes)
        {
            if (delta == 0) return;
            db.StockMovements.Add(new StockMovement
            {
                Product = product,
                Warehouse = warehouse,
                Type = type,
                QuantityDelta = delta,
                ReferenceNumber = type == StockMovementType.Inbound ? $"GRN-{at:yyMMdd}-{random.Next(100, 999)}" : $"SO-{at:yyMMdd}-{random.Next(100, 999)}",
                Notes = notes ?? "Seeded history",
                CreatedAt = at > now ? now : at,
            });
        }
    }

    private static PurchaseOrder NewOrder(
        string number, Supplier supplier, Warehouse warehouse, PurchaseOrderStatus status, DateTime createdAt,
        params (Product Product, int Quantity, decimal UnitCost)[] lines)
    {
        var order = new PurchaseOrder
        {
            OrderNumber = number,
            Supplier = supplier,
            Warehouse = warehouse,
            Status = status,
            CreatedAt = createdAt,
            Items = lines.Select(l => new PurchaseOrderItem { Product = l.Product, Quantity = l.Quantity, UnitCost = l.UnitCost }).ToList(),
        };
        order.TotalAmount = order.Items.Sum(i => i.Quantity * i.UnitCost);
        return order;
    }
}
