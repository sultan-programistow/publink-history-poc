import { useState } from 'react';

export type HistoryEntry = {
  Id: number;
  OrganizationId: string | null;
  UserId: string | null;
  UserEmail: string | null;
  Type: number;
  EntityType: number;
  CreatedDate: string;
  OldValues: string | null;
  NewValues: string | null;
  AffectedColumns: string | null;
  PrimaryKey: string | null;
  EntityId: string | null;
  ParentId: string | null;
  CorrelationId: string | null;
  SubUnitId: string | null;
  UnitId: string | null;
};

const entityName: Record<number, string> = {
  0: 'PositionKeys',
  1: 'Document (contract)',
  2: 'Document (annex)',
  3: 'AnnexChange',
  4: 'File',
  5: 'Invoice',
  6: 'PaymentSchedule',
  7: 'ContractFunding',
  8: 'Representative',
  9: 'Contractor',
  10: 'DocumentRepresentative',
  11: 'Tag',
  12: 'TagAssignment',
  13: 'TagRelation',
  14: 'Obligations',
  15: 'CruPublications',
  16: 'ContractChange',
  17: 'Disclosure',
};
const typeName = (t: number) => (({ 1: 'Insert', 2: 'Delete', 3: 'Update' }) as Record<number, string>)[t] ?? `Type ${t}`;

function getDisplayName(h: HistoryEntry): string {
  const src = h.NewValues ?? h.OldValues;
  if (src) {
    try {
      const j = JSON.parse(src);
      if (typeof j === 'object' && j !== null) {
        return j.Name ?? j.Subject ?? j.Number ?? j.Label ?? j.Title ?? j.ContractNumber ?? j.InternalNumber ?? '';
      }
    } catch (_e) {
      void _e;
    }
  }
  return '';
}

function tryPretty(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export default function AuditRow({ h }: { h: HistoryEntry }) {
  const [open, setOpen] = useState(false);
  const displayName = getDisplayName(h) || entityName[h.EntityType] || `EntityType ${h.EntityType}`;
  const pill = typeName(h.Type);
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span className="badge" style={{ flexShrink: 0 }} title={h.CreatedDate}>
            {new Date(h.CreatedDate).toLocaleString()}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={displayName}>
            {displayName}
          </span>
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge">{entityName[h.EntityType] ?? `EntityType ${h.EntityType}`}</span>
            <span className={`pill pill-${pill.toLowerCase()}`}>{pill}</span>
            <span className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {h.UserEmail ?? h.UserId}
            </span>
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            Corr <code title={h.CorrelationId ?? ''}>{h.CorrelationId?.slice(0, 8) ?? '—'}</code>
          </span>
        </span>
      </div>
      {!open && h.AffectedColumns && (
        <p style={{ marginTop: 6 }}>
          <b>Affected:</b> <code>{h.AffectedColumns}</code>
        </p>
      )}
      <details style={{ marginTop: 8 }} open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Details</summary>
        {h.OldValues && (
          <>
            <div className="muted">OldValues</div>
            <pre>{tryPretty(h.OldValues)}</pre>
          </>
        )}
        {h.NewValues && (
          <>
            <div className="muted">NewValues</div>
            <pre>{tryPretty(h.NewValues)}</pre>
          </>
        )}
        {!h.OldValues && !h.NewValues && <p className="muted">—</p>}
      </details>
    </div>
  );
}
