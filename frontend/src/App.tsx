import { useEffect, useState } from 'react'

type HistoryEntry = {
  Id: number
  OrganizationId: string | null
  UserId: string | null
  UserEmail: string | null
  Type: number // 1 Insert 2 Delete 3 Update
  EntityType: number
  CreatedDate: string
  OldValues: string | null
  NewValues: string | null
  AffectedColumns: string | null
  PrimaryKey: string | null
  EntityId: string | null
  ParentId: string | null
  CorrelationId: string | null
  SubUnitId: string | null
  UnitId: string | null
}

const entityName: Record<number, string> = {
  0: 'PositionKeys', 1: 'Document (contract)', 2: 'Document (annex)', 3: 'AnnexChange',
  4: 'File', 5: 'Invoice', 6: 'PaymentSchedule', 7: 'ContractFunding', 8: 'Representative',
  9: 'Contractor', 10: 'DocumentRepresentative', 11: 'Tag', 12: 'TagAssignment', 13: 'TagRelation',
  14: 'Obligations', 15: 'CruPublications', 16: 'ContractChange', 17: 'Disclosure'
}
const typeName = (t: number) => ({ 1: 'Insert', 2: 'Delete', 3: 'Update' } as Record<number,string>)[t] ?? `Type ${t}`

function isUuid(s: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) }

export default function App() {
  const [docId, setDocId] = useState('f2191c6c-8623-4962-a11d-dcbe0f168b21')
  const [includeChildren, setIncludeChildren] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [data, setData] = useState<{ header:any, history: HistoryEntry[], count:number } | null>(null)
  const [recent, setRecent] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/documents?take=10').then(r=>r.json()).then(setRecent).catch(()=>{})
  }, [])

  async function fetchHistory() {
    if (!isUuid(docId.trim())) { setError('DocumentId must be a UUID (DocumentHeader.Id)'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/documents/${docId.trim()}/history?includeChildren=${includeChildren}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || res.statusText)
      setData(j)
    } catch (e:any) { setError(e.message); setData(null) }
    finally { setLoading(false) }
  }

  return (
    <div className="container">
      <h1 style={{marginBottom: 8}}>Document History — PoC</h1>
      <p className="muted">MVP: chronological audit trail for a given <code>DocumentHeader.Id</code> (UUID). Full aggregate = header + children (<code>ParentId=documentId</code>). Read-only, no auth.</p>

      <div className="card">
        <div className="row">
          <input style={{flex:1, minWidth:260}} value={docId} onChange={e=>setDocId(e.target.value)} placeholder="DocumentId UUID e.g. f2191c6c-8623-4962-a11d-dcbe0f168b21" />
          <label className="row" style={{gap:6}}><input type="checkbox" checked={includeChildren} onChange={e=>setIncludeChildren(e.target.checked)} /> include children (ParentId)</label>
          <button onClick={fetchHistory} disabled={loading}>{loading ? 'Loading…' : 'Fetch history'}</button>
        </div>
        {error && <p style={{color:'#b91c1c', marginTop:10}}>{error}</p>}
        {recent.length>0 && (
          <div style={{marginTop:12}}>
            <span className="muted">Try recent:</span>{' '}
            {recent.map((d:any)=>(
              <button key={d.Id} onClick={()=>setDocId(d.Id)} style={{padding:'4px 8px', fontSize:12, margin:'4px 4px 0 0', background:'#fff', color:'#111'}}>{d.Number || d.Subject?.slice(0,24) || d.Id.slice(0,8)}</button>
            ))}
            <span className="muted" style={{marginLeft:8}}>({recent[0]?.Id})</span>
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="card">
            <h3>Document: <code>{data.header?.Id ?? docId}</code></h3>
            {data.header ? <p className="muted">{data.header.Number ? `Number ${data.header.Number} — ` : ''}{data.header.Subject ?? ''} • Type {data.header.DocumentType} • Org {String(data.header.OrganizationId).slice(0,8)}</p> : <p className="muted">Header not found (audit only, maybe deleted).</p>}
            <p style={{marginTop:8}}><span className="badge">{data.count} audit rows</span> <span className="badge">{includeChildren ? 'header + children' : 'header only'}</span></p>
          </div>

          <div className="timeline">
            {data.history.length===0 && <p className="muted">No audit rows.</p>}
            {data.history.map(h=>(
              <div key={h.Id} className="card">
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span><span className="dot" /> <b>#{h.Id}</b> {typeName(h.Type)} • {entityName[h.EntityType] ?? `EntityType ${h.EntityType}`} <span className="badge">{new Date(h.CreatedDate).toLocaleString()}</span></span>
                  <span className="muted">{h.UserEmail ?? h.UserId}</span>
                </div>
                <p className="muted" style={{marginTop:6}}>EntityId <code>{h.EntityId ?? '—'}</code> • ParentId <code>{h.ParentId ?? '—'}</code> • Corr <code>{h.CorrelationId?.slice(0,8) ?? '—'}</code></p>
                {h.AffectedColumns && <p style={{marginTop:6}}><b>Affected:</b> <code>{h.AffectedColumns}</code></p>}
                <details style={{marginTop:8}} open={h.Type===3}>
                  <summary>payload (Old/New JSON)</summary>
                  {h.OldValues && <><div className="muted">OldValues</div><pre>{tryPretty(h.OldValues)}</pre></>}
                  {h.NewValues && <><div className="muted">NewValues</div><pre>{tryPretty(h.NewValues)}</pre></>}
                  {!h.OldValues && !h.NewValues && <p className="muted">—</p>}
                </details>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="muted" style={{marginTop:24}}>API: <code>GET /api/documents/:id/history?includeChildren=true</code> • <code>GET /api/documents</code> • <code>GET /health</code> — Backend is .NET 10 minimal API + Dapper on Azure SQL.</p>
    </div>
  )
}

function tryPretty(s: string) {
  try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
}
