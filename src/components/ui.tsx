import { useState } from 'react'
import type { SchemeRecord } from '../lib/kb/types.ts'

export function UrgencyBadge({ level }: { level: string | null }) {
  if (!level) return <span className="badge">unknown</span>
  return <span className={`badge urgency-${level}`}>{level}</span>
}

export function Status({ kind, children }: { kind: 'loading' | 'error' | 'empty' | 'info'; children: React.ReactNode }) {
  return (
    <div className={`status status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <span className="spinner" aria-hidden />}
      <span>{children}</span>
    </div>
  )
}

/** Citation chip "#<id> <name>, page <n>" that expands to show the full record and its official source. */
export function CitationChip({ n, record, score }: { n?: number; record: SchemeRecord; score?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`chip-wrap ${open ? 'open' : ''}`}>
      <button type="button" className="chip" aria-expanded={open} onClick={() => setOpen(!open)}>
        {n !== undefined && <span className="chip-n">[{n}]</span>}#{record.id} {record.name}, page {record.page}
        {record.kind === 'regulatory' && <span className="chip-tag">rule</span>}
      </button>
      {open && (
        <dl className="record">
          <dt>Level</dt>
          <dd>{record.level}</dd>
          <dt>Authority</dt>
          <dd>{record.authority}</dd>
          <dt>Complaint domains</dt>
          <dd>{record.complaint_domains}</dd>
          <dt>What it does</dt>
          <dd>{record.what_it_does}</dd>
          <dt>Applicability</dt>
          <dd>{record.applicability}</dd>
          <dt>Type</dt>
          <dd>{record.kind === 'regulatory' ? 'Regulatory reference (a legal rule, not a benefit)' : 'Scheme / programme'}</dd>
          {score !== undefined && (
            <>
              <dt>Match score</dt>
              <dd>{score.toFixed(3)}</dd>
            </>
          )}
          <dt>Official source</dt>
          <dd>
            <a href={record.official_source} target="_blank" rel="noopener noreferrer">
              {record.official_source}
            </a>
          </dd>
        </dl>
      )}
    </div>
  )
}
