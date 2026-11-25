using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Ims.Api.Infrastructure;

/// <summary>Business-rule failure that maps to an RFC 7807 problem response.</summary>
public abstract class ApiException(int statusCode, string title, string detail) : Exception(detail)
{
    public int StatusCode { get; } = statusCode;
    public string Title { get; } = title;
    public IDictionary<string, object?> Extensions { get; } = new Dictionary<string, object?>();
}

public sealed class NotFoundException(string detail) : ApiException(StatusCodes.Status404NotFound, "Not found", detail);

public sealed class ForbiddenException(string detail) : ApiException(StatusCodes.Status403Forbidden, "Forbidden", detail);

public sealed class ConflictException(string detail) : ApiException(StatusCodes.Status409Conflict, "Conflict", detail);

public sealed class BusinessValidationException(string detail) : ApiException(StatusCodes.Status400BadRequest, "Validation failed", detail);

/// <summary>Raised when an outbound/transfer would take a warehouse below zero.</summary>
public sealed class InsufficientStockException : ApiException
{
    public InsufficientStockException(string productSku, string warehouseCode, int available, int requested)
        : base(StatusCodes.Status409Conflict, "Insufficient stock",
            $"Only {available} unit(s) of {productSku} available in {warehouseCode}; {requested} requested.")
    {
        Extensions["available"] = available;
        Extensions["requested"] = requested;
    }
}

/// <summary>Turns <see cref="ApiException"/>s into problem details; everything else is a logged 500.</summary>
public sealed class ApiExceptionHandler(IProblemDetailsService problemDetails, ILogger<ApiExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        ProblemDetails problem;
        if (exception is ApiException api)
        {
            problem = new ProblemDetails { Status = api.StatusCode, Title = api.Title, Detail = api.Message };
            foreach (var (key, value) in api.Extensions) problem.Extensions[key] = value;
        }
        else
        {
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", http.Request.Method, http.Request.Path);
            problem = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Unexpected error",
                Detail = "Something went wrong. The error has been logged.",
            };
        }

        http.Response.StatusCode = problem.Status!.Value;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = problem,
            Exception = exception,
        });
    }
}
