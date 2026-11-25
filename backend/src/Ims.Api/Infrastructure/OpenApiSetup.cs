using System.Reflection;
using Microsoft.OpenApi;

namespace Ims.Api.Infrastructure;

/// <summary>Swagger / OpenAPI with a JWT "Authorize" button.</summary>
public static class OpenApiSetup
{
    private const string BearerScheme = "Bearer";

    public static IServiceCollection AddOpenApiDocumentation(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "IMS API",
                Version = "v1",
                Description =
                    "Multi-warehouse inventory API. Sign in with POST /api/auth/login, then click **Authorize** " +
                    "and paste the `accessToken`. Demo logins: admin@ims.com / Admin123! (SuperAdmin), " +
                    "manager@ims.com / Manager123! (Admin), operator@ims.com / Operator123! (User).",
            });

            options.AddSecurityDefinition(BearerScheme, new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "Paste the accessToken from /api/auth/login (without the 'Bearer ' prefix).",
            });
            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference(BearerScheme, document)] = [],
            });

            var xml = Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
            if (File.Exists(xml)) options.IncludeXmlComments(xml);
        });
        return services;
    }

    public static WebApplication UseSwaggerDocumentation(this WebApplication app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "IMS API v1");
            options.DocumentTitle = "IMS API";
            options.EnablePersistAuthorization();
            options.DisplayRequestDuration();
        });
        return app;
    }
}
