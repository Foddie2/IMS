using System.Text.Json;
using Ims.Api.Data;
using Ims.Api.Domain;

namespace Ims.Api.Services;

/// <summary>
/// Stages audit entries on the current <see cref="ApplicationDbContext"/> so they are saved in the
/// same transaction as the change they describe (no audit row without the change, and vice versa).
/// </summary>
public sealed class AuditLogger(ApplicationDbContext db, TimeProvider clock)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public void Record(int? userId, string action, string entityName, object? entityId, object? details = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = action,
            EntityName = entityName,
            EntityId = entityId?.ToString(),
            Details = details is null ? null : JsonSerializer.Serialize(details, Json),
            Timestamp = clock.GetUtcNow().UtcDateTime,
        });
    }
}
