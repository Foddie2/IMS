using Ims.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Ims.Api.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    /// <summary>
    /// Private schema: Supabase's public Data API (PostgREST) only exposes <c>public</c>,
    /// so nothing here – password hashes included – is reachable except through this API.
    /// </summary>
    public const string Schema = "ims";

    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<WarehouseInventory> Inventory => Set<WarehouseInventory>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasDefaultSchema(Schema);

        model.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).HasMaxLength(256);
            e.Property(u => u.FullName).HasMaxLength(200);
            e.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        });

        model.Entity<Category>(e =>
        {
            e.HasIndex(c => c.Name).IsUnique();
            e.Property(c => c.Name).HasMaxLength(100);
            e.Property(c => c.Description).HasMaxLength(500);
        });

        model.Entity<Warehouse>(e =>
        {
            e.HasIndex(w => w.Code).IsUnique();
            e.Property(w => w.Code).HasMaxLength(10);
            e.Property(w => w.Name).HasMaxLength(100);
            e.Property(w => w.City).HasMaxLength(100);
            e.Property(w => w.MapX).HasPrecision(5, 2);
            e.Property(w => w.MapY).HasPrecision(5, 2);
        });

        model.Entity<Product>(e =>
        {
            e.HasIndex(p => p.Sku).IsUnique();
            e.Property(p => p.Sku).HasMaxLength(64);
            e.Property(p => p.Name).HasMaxLength(200);
            e.Property(p => p.Description).HasMaxLength(2000);
            e.Property(p => p.Units).HasMaxLength(20);
            e.Property(p => p.Barcode).HasMaxLength(64);
            e.Property(p => p.ImageUrl).HasMaxLength(500);
            e.Property(p => p.UnitPrice).HasPrecision(12, 2);
            e.HasOne(p => p.Category).WithMany(c => c.Products).OnDelete(DeleteBehavior.SetNull);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_products_unit_price_non_negative", "unit_price >= 0");
                t.HasCheckConstraint("ck_products_minimum_stock_non_negative", "minimum_stock >= 0");
            });
        });

        model.Entity<WarehouseInventory>(e =>
        {
            e.ToTable("warehouse_inventory", t =>
                t.HasCheckConstraint("ck_warehouse_inventory_quantity_non_negative", "quantity >= 0"));
            e.HasIndex(i => new { i.ProductId, i.WarehouseId }).IsUnique();
            e.HasOne(i => i.Product).WithMany(p => p.Inventory).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(i => i.Warehouse).WithMany(w => w.Inventory).OnDelete(DeleteBehavior.Cascade);
            // Maps to PostgreSQL's xmin system column: concurrent edits of a row are detected, not lost.
            e.Property(i => i.Version).IsRowVersion();
        });

        model.Entity<StockMovement>(e =>
        {
            e.Property(m => m.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(m => m.ReferenceNumber).HasMaxLength(64);
            e.Property(m => m.Notes).HasMaxLength(1000);
            e.HasIndex(m => m.CreatedAt);
            e.HasIndex(m => new { m.ProductId, m.WarehouseId });
            e.HasOne(m => m.Product).WithMany().OnDelete(DeleteBehavior.Restrict);
            e.HasOne(m => m.Warehouse).WithMany().OnDelete(DeleteBehavior.Restrict);
            e.HasOne(m => m.PerformedByUser).WithMany().OnDelete(DeleteBehavior.SetNull);
            e.ToTable(t => t.HasCheckConstraint("ck_stock_movements_delta_non_zero", "quantity_delta <> 0"));
        });

        model.Entity<Supplier>(e =>
        {
            e.Property(s => s.Name).HasMaxLength(200);
            e.Property(s => s.ContactEmail).HasMaxLength(256);
            e.Property(s => s.Phone).HasMaxLength(50);
        });

        model.Entity<PurchaseOrder>(e =>
        {
            e.HasIndex(o => o.OrderNumber).IsUnique();
            e.Property(o => o.OrderNumber).HasMaxLength(32);
            e.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(o => o.TotalAmount).HasPrecision(14, 2);
            e.HasOne(o => o.Supplier).WithMany().OnDelete(DeleteBehavior.Restrict);
            e.HasOne(o => o.Warehouse).WithMany().OnDelete(DeleteBehavior.Restrict);
        });

        model.Entity<PurchaseOrderItem>(e =>
        {
            e.Property(i => i.UnitCost).HasPrecision(12, 2);
            e.HasOne(i => i.PurchaseOrder).WithMany(o => o.Items).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(i => i.Product).WithMany().OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t => t.HasCheckConstraint("ck_purchase_order_items_quantity_positive", "quantity > 0"));
        });

        model.Entity<AuditLog>(e =>
        {
            e.Property(a => a.Action).HasMaxLength(64);
            e.Property(a => a.EntityName).HasMaxLength(64);
            e.Property(a => a.EntityId).HasMaxLength(64);
            e.HasIndex(a => a.Timestamp);
            if (Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                e.Property(a => a.Details).HasColumnType("jsonb");
            }
        });
    }
}
