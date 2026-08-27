using System.Data;
using System.Collections;
using Dapper;
using Microsoft.Data.SqlClient;

// Load .env for local dev (repo root .env, backend/.env) — ignored by git via .gitignore
try { DotNetEnv.Env.TraversePath().Load(); } catch { }
try { DotNetEnv.Env.Load(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".env")); } catch { }
try { DotNetEnv.Env.Load(); } catch { }

var builder = WebApplication.CreateSlimBuilder(args);

// Vercel injects PORT, .NET 8+ default is 8080 — bind explicitly to PORT
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();
app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

// health
app.MapGet("/health", () => Results.Json(new { status = "ok", port }));
app.MapGet("/api/health", () => Results.Json(new { status = "ok", port, db = HasConnectionString() ? "configured" : "missing" }));

bool HasConnectionString() => !string.IsNullOrWhiteSpace(
    Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
    ?? app.Configuration.GetConnectionString("Default")
    ?? app.Configuration["DATABASE_CONNECTION_STRING"]);

string GetConnectionString()
{
    var cs = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
          ?? app.Configuration.GetConnectionString("Default")
          ?? app.Configuration["DATABASE_CONNECTION_STRING"]
          ?? "";
    return cs;
}

// GET current document header
app.MapGet("/api/documents/{id:guid}", async (Guid id) =>
{
    var cs = GetConnectionString();
    if (string.IsNullOrWhiteSpace(cs)) return Results.Json(new { error = "ConnectionString missing. Set DATABASE_CONNECTION_STRING env var." }, statusCode: 500);
    try
    {
        using var conn = new SqlConnection(cs);
        var row = await conn.QuerySingleOrDefaultAsync(
            "SELECT * FROM dbo.DocumentHeader WHERE Id = @id", new { id });
        return row is null ? Results.NotFound(new { error = "Document not found", id }) : Results.Json(row);
    }
    catch (Exception ex) { return Results.Json(new { error = ex.Message }, statusCode: 500); }
});

// GET history for document — full aggregate: EntityId=documentId OR ParentId=documentId, chronological
app.MapGet("/api/documents/{id:guid}/history", async (Guid id, bool? includeChildren) =>
{
    var cs = GetConnectionString();
    if (string.IsNullOrWhiteSpace(cs)) return Results.Json(new { error = "ConnectionString missing. Set DATABASE_CONNECTION_STRING env var (or .env)." }, statusCode: 500);
    var include = includeChildren ?? true;
    try
    {
        using var conn = new SqlConnection(cs);
        // verify doc exists (optional, not required for audit query)
        IEnumerable<dynamic> rows;
        if (include)
        {
            rows = await conn.QueryAsync(@"
SELECT Id, OrganizationId, UserId, UserEmail, Type, EntityType, CreatedDate,
       OldValues, NewValues, AffectedColumns, PrimaryKey, EntityId, ParentId, CorrelationId, SubUnitId, UnitId
FROM dbo.AuditLog
WHERE (EntityType IN (1,2) AND EntityId = @id) OR ParentId = @id
ORDER BY CreatedDate ASC, Id ASC", new { id });
        }
        else
        {
            rows = await conn.QueryAsync(@"
SELECT Id, OrganizationId, UserId, UserEmail, Type, EntityType, CreatedDate,
       OldValues, NewValues, AffectedColumns, PrimaryKey, EntityId, ParentId, CorrelationId, SubUnitId, UnitId
FROM dbo.AuditLog
WHERE EntityType IN (1,2) AND EntityId = @id
ORDER BY CreatedDate ASC, Id ASC", new { id });
        }

        // also fetch current header for context
        var header = await conn.QuerySingleOrDefaultAsync("SELECT Id, Number, Subject, DocumentType, OrganizationId FROM dbo.DocumentHeader WHERE Id=@id", new { id });

        return Results.Json(new { documentId = id, includeChildren = include, header, count = (rows as List<dynamic>)?.Count ?? 0, history = rows });
    }
    catch (Exception ex) { return Results.Json(new { error = ex.Message }, statusCode: 500); }
});

// list recent documents for picker
app.MapGet("/api/documents", async (int? take) =>
{
    var cs = GetConnectionString();
    if (string.IsNullOrWhiteSpace(cs)) return Results.Json(new { error = "ConnectionString missing." }, statusCode: 500);
    var n = Math.Clamp(take ?? 20, 1, 100);
    try
    {
        using var conn = new SqlConnection(cs);
        var rows = await conn.QueryAsync(
            "SELECT TOP (@n) Id, Number, Subject, DocumentType, CreatedDate, OrganizationId FROM dbo.DocumentHeader ORDER BY CreatedDate DESC", new { n });
        return Results.Json(rows);
    }
    catch (Exception ex) { return Results.Json(new { error = ex.Message }, statusCode: 500); }
});

// fallback to SPA (for single-container deploy: .NET serves React from wwwroot)
app.MapFallbackToFile("index.html");

app.Logger.LogInformation("Listening on {Urls} port {Port} dbConfigured={Db}", string.Join(",", app.Urls), port, HasConnectionString());
app.Run();
