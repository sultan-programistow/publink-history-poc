# Document History PoC — ASP.NET Core 10 + React on single Vercel Container

**Single-platform, single-env, credit-card-free** — frontend and API run in one Docker image on Vercel (Fluid Functions, scales to zero).

* **Backend**: `backend/` — .NET 10 Minimal API (`CreateSlimBuilder`, binds `0.0.0.0:$PORT`), Dapper + `Microsoft.Data.SqlClient` against `sqldb-umowy-dev`. Endpoints:
  * `GET /health` / `GET /api/health`
  * `GET /api/documents?take=20` — picker (uses `DocumentHeader` list)
  * `GET /api/documents/{uuid}` — current header
  * `GET /api/documents/{uuid}/history?includeChildren=true` — **chronological** (`ORDER BY CreatedDate, Id`) full aggregate: `WHERE (EntityType IN (1,2) AND EntityId=@id) OR ParentId=@id` (header + ContractChange/Cru/etc). `?includeChildren=false` = header only. MVP: no auth, no filters, simple JSON list.
* **Frontend**: `frontend/` — Vite + React 18 + TS, input `DocumentHeader.Id` UUID, toggle `include children`, fetch + render timeline (Type Insert/Delete/Update, EntityType name, CreatedDate, UserEmail, AffectedColumns, Old/New pretty JSON).
* **Deploy**: one `Dockerfile.vercel` (Node builds frontend → copy to `backend/wwwroot` → .NET publish → `aspnet:10.0-noble-chiseled` runtime) + `vercel.json` `{ services:{api:{runtime:"container", entrypoint:"Dockerfile.vercel"}}, rewrites:["/(.*)"] }` → `https://your-project.vercel.app` serves both API and SPA.

## Local dev (free, no card)

Prereqs: Node 20, .NET SDK 10, Docker, Vercel CLI `npm i -g vercel`.

```bash
# 1. env
cp .env.example .env   # paste readonly DATABASE_CONNECTION_STRING (auto-loaded via DotNetEnv)
# also:
export DATABASE_CONNECTION_STRING="Server=tcp:sql-common-publink-dev..."

# 2a. split dev (hot reload)
cd frontend && npm install && npm run dev   # 5173 proxies /api to 8080
# in another terminal:
dotnet run --project backend --urls http://localhost:8080

# 2b. single-container local (like prod)
docker build -f Dockerfile.vercel -t hist:local . && docker run -p 3000:8080 -e DATABASE_CONNECTION_STRING="$DATABASE_CONNECTION_STRING" -e PORT=8080 hist:local
curl http://localhost:3000/health
curl "http://localhost:3000/api/documents/f2191c6c-8623-4962-a11d-dcbe0f168b21/history?includeChildren=true"

# via Vercel CLI (uses Container Registry)
vercel login
vercel env add DATABASE_CONNECTION_STRING  # paste value, add to Production + Preview
vercel dev -L   # http://localhost:3000
vercel deploy --prod
```

## Vercel notes (from https://vercel.com/kb/guide/dot-net-asp-net-on-vercel-with-docker)

* Bind `0.0.0.0:$PORT` (code does `UseUrls`), don't hardcode 8080/80; `EXPOSE` is ignored; `PORT` defaults to `8080` here to avoid privileged-port with non-root `app` user.
* No persistent FS — DB is external Azure SQL (configure firewall `Allow Azure services` or add Vercel outgoing IPs).
* `DOTNET_EnableDiagnostics=0`, log to console only, keep DB pool small (`MultipleActiveResultSets=False`), request limit 4.5 MB.
* Hobby plan: ~100 GB-hours free, container sleeps when idle (cold start ~1-2s chiseled).

## Test IDs (from dev DB)

* `f2191c6c-8623-4962-a11d-dcbe0f168b21` — first doc in AuditLog (3 audits)
* `0305a7e2-f345-49e4-9fe3-b8725a22b98a` — most audited (149 rows: `Umowa testowa Zuza`)
* `a9446e8d-30c2-403d-8292-3ddd900970b5` — random `AD.2150.07.2025`

## Next steps (post-MVP)

Add `?from=&to=` filters, `EntityType` legend from `EntityTypes.txt`, diff viewer for `OldValues→NewValues`, pagination (`TOP` + cursor), and (later) auth (external IdP) + `OrganizationId` scoping.
