using System.Data;
using System.Collections;
using Dapper;
using Microsoft.Data.SqlClient;

// Load .env for local dev (repo root .env) — ignored by git via .gitignore
try { DotNetEnv.Env.TraversePath().Load(); } catch { }

var builder = WebApplication.CreateSlimBuilder(args);

// Vercel injects PORT, .NET 8+ default is 8080 — bind explicitly to PORT
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Fail-fast on missing DB connection — no per-endpoint checks needed
var connectionString = app.Configuration["DATABASE_CONNECTION_STRING"]
    ?? Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
    ?? "";
if (string.IsNullOrWhiteSpace(connectionString))
{
    var msg = "DATABASE_CONNECTION_STRING is missing. Provide it via repo-root .env (DATABASE_CONNECTION_STRING=...) or Vercel env var DATABASE_CONNECTION_STRING.";
    app.Logger.LogCritical(msg);
    Console.Error.WriteLine($"FATAL: {msg}");
    Environment.Exit(1);
}

app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

// GET current document header
app.MapGet("/api/documents/{id:guid}", async (Guid id) =>
{
    try
    {
        using var conn = new SqlConnection(connectionString);
        var row = await conn.QuerySingleOrDefaultAsync(
            "SELECT * FROM dbo.DocumentHeader WHERE Id = @id", new { id }
        );
        return row is null ? Results.NotFound(new { error = "Document not found", id }) : Results.Json(row);
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

// GET history for document — full aggregate: EntityId=documentId OR ParentId=documentId, chronological (always full)
app.MapGet("/api/documents/{id:guid}/history", async (Guid id) =>
{
    try
    {
        using var conn = new SqlConnection(connectionString);
        var rows = await conn.QueryAsync(@"
SELECT Id, OrganizationId, UserId, UserEmail, Type, EntityType, CreatedDate,
       OldValues, NewValues, AffectedColumns, PrimaryKey, EntityId, ParentId, CorrelationId, SubUnitId, UnitId
FROM dbo.AuditLog
WHERE (EntityType IN (1,2) AND EntityId = @id) OR ParentId = @id
ORDER BY CreatedDate DESC, Id DESC", new { id });

        // also fetch current header for context
        var header = await conn.QuerySingleOrDefaultAsync(
            "SELECT Id, Number, Subject, DocumentType, OrganizationId FROM dbo.DocumentHeader WHERE Id=@id", new { id }
        );

        // join files directly into history response — only active (DeletedDate IS NULL) mock links
        var files = await conn.QueryAsync(
            @"SELECT Id, Name, Extension, Type, CreatedDate, ParentType, ParentId
              FROM dbo.[File] WHERE ParentId = @id AND DeletedDate IS NULL ORDER BY CreatedDate DESC",
            new { id }
        );

        return Results.Json(new { documentId = id, header, files, count = (rows as List<dynamic>)?.Count ?? 0, history = rows });
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

// list recent documents for picker — only those with at least one audit log + interesting names (CTE+JOIN ~0.05s)
app.MapGet("/api/documents", async (int? take) =>
{
    var n = Math.Clamp(take ?? 20, 1, 100);
    try
    {
        using var conn = new SqlConnection(connectionString);
        // Pristine (real recent, even with empty audit / empty names) — kept for reference:
        // var pristineSql = $"SELECT TOP {n} Id, Number, Subject, DocumentType, CreatedDate, OrganizationId FROM dbo.DocumentHeader ORDER BY CreatedDate DESC";
        var sql = $@"
              WITH Audited AS (
                SELECT DISTINCT EntityId AS DocId FROM dbo.AuditLog WHERE EntityType IN (1,2) AND EntityId IS NOT NULL
                UNION
                SELECT DISTINCT ParentId FROM dbo.AuditLog WHERE ParentId IS NOT NULL
              )
              SELECT TOP {n} dh.Id, dh.Number, dh.Subject, dh.DocumentType, dh.CreatedDate, dh.OrganizationId
              FROM dbo.DocumentHeader dh
              JOIN Audited a ON a.DocId = dh.Id
              WHERE ISNULL(LTRIM(RTRIM(dh.Number)), '') <> ''
                AND LEN(LTRIM(RTRIM(dh.Number))) > 2
                AND ISNULL(LTRIM(RTRIM(dh.Subject)), '') <> ''
                AND LTRIM(RTRIM(dh.Subject)) NOT IN ('string', '-', 'test', 'string new 222')
                AND LEN(LTRIM(RTRIM(dh.Subject))) > 5
              ORDER BY dh.CreatedDate DESC";
        var rows = await conn.QueryAsync(sql);
        return Results.Json(rows);
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

// search documents by Number / Subject / Id (for autocomplete)
app.MapGet("/api/documents/search", async (string? q, int? take) =>
{
    var term = (q ?? "").Trim();
    if (string.IsNullOrWhiteSpace(term) || term.Length < 2)
    {
        return Results.Json(Array.Empty<object>());
    }

    var n = Math.Clamp(take ?? 10, 1, 20);
    var like = $"%{term}%";
    try
    {
        using var conn = new SqlConnection(connectionString);
        var sql = $@"
              SELECT TOP {n} Id, Number, Subject, DocumentType, CreatedDate
              FROM dbo.DocumentHeader
              WHERE Number LIKE @like OR Subject LIKE @like OR CAST(Id AS nvarchar(36)) LIKE @like
              ORDER BY CreatedDate DESC";
        var rows = await conn.QueryAsync(sql, new { like });
        return Results.Json(rows);
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

// audit stats for footer (oldest entry + total)
app.MapGet("/api/audit/stats", async () =>
{
    try
    {
        using var conn = new SqlConnection(connectionString);
        var row = await conn.QuerySingleAsync(
            "SELECT MIN(CreatedDate) AS Oldest, MAX(CreatedDate) AS Newest, COUNT(*) AS Total FROM dbo.AuditLog"
        );
        return Results.Json(row);
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

// fallback to SPA (for single-container deploy: .NET serves React from wwwroot)
app.MapFallbackToFile("index.html");
app.Logger.LogInformation("Listening on '{Urls}' port {Port}", string.Join(",", app.Urls), port);
app.Run();
