import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import AsyncSelect from 'react-select/async';
/* eslint-disable react-hooks/exhaustive-deps */
import AuditRow, { HistoryEntry } from './AuditRow';

const docTypeName = (t: number) => (({ 1: 'Contract', 2: 'Annex' }) as Record<number, string>)[t] ?? `Type ${t}`;
function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function formatDocLabel(d: { Id: string; Number?: string | null; Subject?: string | null }): string {
  const rawNum = (d.Number || '').trim();
  const numLabel = rawNum ? (rawNum.length > 24 ? rawNum.slice(0, 24) + '…' : rawNum) : d.Id.slice(0, 8);
  const rawSubj = (d.Subject || '').trim();
  const subjLabel = rawSubj ? (rawSubj.length > 60 ? rawSubj.slice(0, 60) + '…' : rawSubj) : 'no subject';
  return `${numLabel} — ${subjLabel}`;
}

type Option = { value: string; label: string; data: any };

export default function App() {
  const [docId, setDocId] = useState('f2191c6c-8623-4962-a11d-dcbe0f168b21');
  const [selected, setSelected] = useState<Option | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ header: any; history: HistoryEntry[]; count: number } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    Oldest: string | null;
    Newest: string | null;
    Total: number;
  } | null>(null);

  useEffect(() => {
    axios
      .get('/api/documents', { params: { take: 10 } })
      .then((r) => setRecent(r.data))
      .catch(() => {});
    axios
      .get('/api/audit/stats')
      .then((r) => setStats(r.data))
      .catch(() => {});
    // restore from URL ?id=UUID on refresh / share
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('id');
    if (urlId && isUuid(urlId)) {
      setDocId(urlId);
      setSelected({ value: urlId, label: urlId, data: null });
      // fetch after state set — use urlId directly
      setTimeout(() => fetchHistory(urlId), 0);
    }
    const onPop = () => {
      const p = new URLSearchParams(window.location.search).get('id');
      if (p && isUuid(p)) {
        setDocId(p);
        setSelected({ value: p, label: p, data: null });
        fetchHistory(p);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const fetchHistory = useCallback(
    async (idOverride?: string) => {
      const targetId = (idOverride ?? docId).trim();
      if (!isUuid(targetId)) {
        setError('DocumentId must be a UUID (DocumentHeader.Id) — pick a suggestion');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data: j } = await axios.get(`/api/documents/${targetId}/history`);
        setData(j);
        setFiles(Array.isArray(j.files) ? j.files : []);
        // persist in URL for refresh / share
        const url = new URL(window.location.href);
        url.searchParams.set('id', targetId);
        window.history.pushState({}, '', url);
        // update select label to Number — Subject once header known
        if (j.header) {
          setSelected({
            value: targetId,
            label: formatDocLabel({
              Id: targetId,
              Number: j.header.Number,
              Subject: j.header.Subject,
            }),
            data: j.header,
          });
        }
      } catch (e: any) {
        const msg = e.response?.data?.error ?? e.message;
        setError(msg);
        setData(null);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [docId]
  );

  const loadOptions = async (inputValue: string): Promise<Option[]> => {
    if (!inputValue || inputValue.trim().length < 2) return [];
    try {
      const { data } = await axios.get('/api/documents/search', {
        params: { q: inputValue.trim(), take: 10 },
      });
      return (data as any[]).map((d) => ({ value: d.Id, label: formatDocLabel(d), data: d }));
    } catch {
      return [];
    }
  };

  return (
    <div className="container">
      <h1 style={{ marginBottom: 8 }}>Document History — PoC</h1>
      <p className="muted">
        MVP: chronological audit trail for a given document. Type <code>RK.127</code> or paste UUID — picks from{' '}
        <code>Number / Subject / Id</code>.
      </p>

      <div className="card">
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <AsyncSelect<Option>
              cacheOptions
              defaultOptions={false}
              loadOptions={loadOptions}
              value={selected}
              placeholder="Search Number (RK.127…) or paste UUID…"
              isClearable
              noOptionsMessage={({ inputValue }) => (inputValue.length < 2 ? 'Type at least 2 chars' : 'No matches')}
              loadingMessage={() => 'Searching…'}
              onChange={(opt) => {
                setSelected(opt as Option | null);
                if (opt) {
                  setDocId(opt.value);
                  fetchHistory(opt.value);
                }
              }}
              styles={{
                control: (base) => ({ ...base, minHeight: 38 }),
                singleValue: (base) => ({
                  ...base,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }),
                input: (base) => ({
                  ...base,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }),
              }}
            />
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Selected UUID: <code>{docId}</code>
            </div>
          </div>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120, justifyContent: 'center' }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Loading…
              </span>
            </div>
          )}
        </div>
        {error && <p style={{ color: '#b91c1c', marginTop: 10 }}>{error}</p>}
        {recent.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <span className="muted">Recent:</span>{' '}
            {recent.map((d: any) => {
              const opt: Option = { value: d.Id, label: formatDocLabel(d), data: d };
              return (
                <button key={d.Id} style={{padding: '4px 8px', fontSize: 12, margin: '4px 4px 0 0', background: '#fff', color: '#111' }} onClick={() => {
                  setDocId(d.Id);
                  setSelected(opt);
                  fetchHistory(d.Id);
                }}>
                  {d.Number || d.Subject?.slice(0, 24) || d.Id.slice(0, 8)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="card">
            <h3>
              Document: <code>{data.header?.Id ?? docId}</code>
            </h3>
            {data.header ? (
              <p className="muted">
                {data.header.Number ? `Number ${data.header.Number} — ` : ''}
                {data.header.Subject ?? ''} • {docTypeName(data.header.DocumentType)} • Org {String(data.header.OrganizationId).slice(0, 8)}
              </p>
            ) : (
              <p className="muted">Header not found (audit only, maybe deleted).</p>
            )}
            <p style={{ marginTop: 8 }}>
              <span className="badge">{data.count} audit rows</span>
            </p>
            {files.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ marginBottom: 6, fontWeight: 600 }}>
                  Files ({files.length})
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {files.map((f: any) => (
                    <li
                      key={f.Id}
                      style={{padding: '6px 0', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <a href="#" style={{color: '#2563eb', textDecoration: 'underline', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={(e) => {
                        e.preventDefault();
                        alert(`Mock download: ${f.Name}.${f.Extension}\nId: ${f.Id}\n(Bytes live in external Blob storage, not in SQL)`);
                      }}>
                        {f.Name}.{f.Extension}
                      </a>
                      <span className="badge" title={f.CreatedDate}>
                        {new Date(f.CreatedDate).toLocaleDateString()} • {f.Extension}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  Mock links — file bytes are in external Blob (Id is storage key), not in Azure Storage.
                </p>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
                No files attached to this document.
              </p>
            )}
          </div>

          <div className="timeline">
            {data.history.length === 0 && <p className="muted">No audit rows.</p>}
            {data.history.map((h) => (
              <AuditRow key={h.Id} h={h} />
            ))}
          </div>
        </>
      )}

      {stats && (
        <p className="muted" style={{ marginTop: 8, fontSize: 11, textAlign: 'center' }}>
          Audit history available since {stats.Oldest ? new Date(stats.Oldest).toLocaleDateString() : '—'} • {stats.Total?.toLocaleString()}{' '}
          entries total
          {data ? ` — this document: ${data.count} entries` : ''} • coverage until{' '}
          {stats.Newest ? new Date(stats.Newest).toLocaleDateString() : '—'}
        </p>
      )}
    </div>
  );
}
