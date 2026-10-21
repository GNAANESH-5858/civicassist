import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { sourceById } from '../lib/civic/data.ts'
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

export function Status({ kind, children }: { kind: 'loading' | 'error' | 'empty' | 'info' | 'warn' | 'ok'; children: ReactNode }) {
  return (
    <div className={`status status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <span className="spinner" aria-hidden />}
      {kind === 'error' && <IconAlert />}
      {(kind === 'info' || kind === 'warn') && <IconInfo />}
      <span>{children}</span>
    </div>
  )
}

export function UrgencyBadge({ level }: { level: string | null }) {
  const { t } = useTranslation()
  if (!level) return <span className="badge">{t('common.unknown')}</span>
  return <span className={`badge urgency-${level}`}>{t(`common.urgency.${level}`)}</span>
}

/** Shows whether a fact was verified on an official page, with a link to that page and the check date. */
export function VerificationBadge({ status, source }: { status: 'verified' | 'loads' | 'unverified'; source?: string }) {
  const { t } = useTranslation()
  const s = source ? sourceById.get(source) : undefined
  const cls = status === 'verified' ? 'badge-ok' : status === 'loads' ? 'badge-warn' : 'badge-bad'
  return (
    <span className="meta">
      <span className={`badge ${cls}`}>{t(`guidance:verification.${status}`)}</span>
      {s && (
        <span className="source-line">
          {t('common.source')}:{' '}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.title}
          </a>{' '}
          · {t('common.checked_on', { date: s.checked })}
        </span>
      )}
    </span>
  )
}

const SECTIONS: MatchSection[] = ['complaint_domains', 'matching_signals', 'what_it_does']

/** Highlights the matched words inside a section's text. */
export function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>
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
 * One knowledge-base record as an expandable card: every section, the sections that matched,
 * scheme number, PDF page and official source. Record text is the official English corpus.
 */
export function SchemeCard({ n, record, score, boost, match, defaultOpen = false }: { n?: number; record: SchemeRecord; score?: number; boost?: number; match?: MatchBreakdown; defaultOpen?: boolean }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  const matched = match ? SECTIONS.filter((s) => match[s].length) : []
  return (
    <div className={`scheme ${open ? 'open' : ''}`}>
      <button type="button" className="scheme-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {n !== undefined && <span className="scheme-n">[{n}]</span>}
        <span className="scheme-title" lang="en">
          #{record.id} {record.name} {record.kind === 'regulatory' && <span className="tag-rule">{t('schemes.rule')}</span>}
        </span>
        <span className="scheme-meta">{t('schemes.pdf_page', { page: record.page })}</span>
        <IconChevron />
      </button>
      {match && !open && (
        <div className="match-summary">
          {matched.length ? (
            matched.map((s) => (
              <span key={s} className="pill pill-ok">
                ✓ {t(`schemes.section.${s}`)}: {match[s].join(', ')}
              </span>
            ))
          ) : (
            <span className="pill">{t('schemes.matched_meaning')}</span>
          )}
        </div>
      )}
      {open && (
        <div className="scheme-body">
          <div className="sections">
            {SECTIONS.map((s) => {
              const words = match?.[s] ?? []
              return (
                <div key={s} className={`section-row ${words.length ? 'matched' : ''}`}>
                  <div className="label">{t(`schemes.section.${s}`)}</div>
                  <div lang="en">
                    <Highlight text={record[s]} words={words} />
                  </div>
                </div>
              )
            })}
            <div className="section-row">
              <div className="label">{t('schemes.section.applicability')}</div>
              <div lang="en">
                {record.applicability} · {record.level} · {record.authority}
              </div>
            </div>
            <div className="section-row">
              <div className="label">{t('schemes.section.type')}</div>
              <div>{t(record.kind === 'regulatory' ? 'schemes.type_rule' : 'schemes.type_scheme')}</div>
            </div>
            <div className="section-row">
              <div className="label">{t('schemes.section.official_source')}</div>
              <div>
                <a href={record.official_source} target="_blank" rel="noopener noreferrer">
                  <IconLink size={13} /> {record.official_source}
                </a>
              </div>
            </div>
            {score !== undefined && (
              <div className="section-row">
                <div className="label">{t('schemes.section.score')}</div>
                <div>{boost ? t('schemes.score_boost', { score: score.toFixed(3), boost: boost.toFixed(2), final: (score + boost).toFixed(3) }) : t('schemes.score', { score: score.toFixed(3) })}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
