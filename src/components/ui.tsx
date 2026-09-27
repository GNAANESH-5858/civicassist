import { useState, type ReactNode } from 'react'
import type { SchemeRecord } from '../lib/kb/types.ts'
import type { MatchBreakdown, MatchSection } from '../lib/rag/retrieve.ts'
import { IconAlert, IconChevron, IconInfo, IconLink } from './icons.tsx'

export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  )
}

export function UrgencyBadge({ level }: { level: string | null }) {
  if (!level) return <span className="badge">unknown</span>
  return <span className={`badge urgency-${level}`}>{level} urgency</span>
}

export function Status({ kind, children }: { kind: 'loading' | 'error' | 'empty' | 'info'; children: ReactNode }) {
  return (
    <div className={`status status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <span className="spinner" aria-hidden />}
      {kind === 'error' && <IconAlert />}
      {kind === 'info' && <IconInfo />}
      <span>{children}</span>
    </div>
  )
}

const FLAG_LABELS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | '' }> = {
  phone_masked: { label: 'Phone number hidden', tone: 'ok' },
  id_masked: { label: 'ID number hidden', tone: 'ok' },
  email_masked: { label: 'Email hidden', tone: 'ok' },
  possible_repeat: { label: 'Possible repeat', tone: 'warn' },
  ward_missing: { label: 'Ward not found', tone: 'warn' },
  truncated: { label: 'Shortened to 2000 characters', tone: 'warn' },
  possible_injection: { label: 'Contains instructions: treated as text only', tone: 'bad' },
}

export function Flag({ flag }: { flag: string }) {
  const f = FLAG_LABELS[flag] ?? { label: flag, tone: '' }
  return <span className={`pill ${f.tone ? `pill-${f.tone}` : ''}`}>{f.label}</span>
}

const SECTION_LABELS: Record<MatchSection, string> = {
  complaint_domains: 'Complaint domains',
  matching_signals: 'AI matching signals',
  what_it_does: 'What it does',
}

/** Highlights the matched words inside a section's text. */
export function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>
  // Match on a word stem so "lights" also marks "streetlights" and "lighting".
  const stems = words.map((w) => w.toLowerCase().replace(/[^a-z]/g, '').replace(/(ing|ed|es|s)$/, '')).filter((w) => w.length >= 3)
  if (!stems.length) return <>{text}</>
  const re = new RegExp(`[a-z]*(?:${stems.join('|')})[a-z]*`, 'gi')
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    out.push(text.slice(last, m.index), <mark key={m.index}>{m[0]}</mark>)
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

/**
 * One knowledge-base record as an expandable card. Shows every section, which sections
 * matched the citizen's words, the scheme number, PDF page and official source.
 */
export function SchemeCard({ n, record, score, match, defaultOpen = false }: { n?: number; record: SchemeRecord; score?: number; match?: MatchBreakdown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const matchedSections = match ? (Object.keys(SECTION_LABELS) as MatchSection[]).filter((s) => match[s].length) : []
  return (
    <div className={`scheme ${open ? 'open' : ''}`}>
      <button type="button" className="scheme-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {n !== undefined && <span className="scheme-n">[{n}]</span>}
        <span className="scheme-title">
          #{record.id} {record.name} {record.kind === 'regulatory' && <span className="tag-rule">Rule</span>}
        </span>
        <span className="scheme-meta">PDF page {record.page}</span>
        <IconChevron />
      </button>
      {match && !open && (
        <div className="match-summary" style={{ padding: '0 14px 12px' }}>
          {matchedSections.length ? (
            matchedSections.map((s) => (
              <span key={s} className="pill pill-ok">
                ✓ {SECTION_LABELS[s]}: {match[s].join(', ')}
              </span>
            ))
          ) : (
            <span className="pill">Matched by meaning</span>
          )}
        </div>
      )}
      {open && (
        <div className="scheme-body">
          <div className="sections">
            {(Object.keys(SECTION_LABELS) as MatchSection[]).map((s) => {
              const words = match?.[s] ?? []
              const text = s === 'matching_signals' ? record.matching_signals : s === 'complaint_domains' ? record.complaint_domains : record.what_it_does
              return (
                <div key={s} className={`section ${words.length ? 'matched' : ''}`}>
                  <div className="section-label">
                    <span className="dot" />
                    {SECTION_LABELS[s]}
                  </div>
                  <div className="section-text">
                    <Highlight text={text} words={words} />
                  </div>
                </div>
              )
            })}
            <div className="section">
              <div className="section-label">
                <span className="dot" />
                Applicability
              </div>
              <div className="section-text">
                {record.applicability} · {record.level} · {record.authority}
              </div>
            </div>
            <div className="section">
              <div className="section-label">
                <span className="dot" />
                Type
              </div>
              <div className="section-text">{record.kind === 'regulatory' ? 'Regulatory reference: a legal rule, not a benefit you can claim' : 'Scheme / programme: may be applicable, subject to eligibility and local verification'}</div>
            </div>
            <div className="section">
              <div className="section-label">
                <span className="dot" />
                Official source
              </div>
              <div className="section-text">
                <a href={record.official_source} target="_blank" rel="noopener noreferrer">
                  <IconLink size={13} /> {record.official_source}
                </a>
              </div>
            </div>
            {score !== undefined && (
              <div className="section">
                <div className="section-label">
                  <span className="dot" />
                  Similarity
                </div>
                <div className="section-text">{score.toFixed(3)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
