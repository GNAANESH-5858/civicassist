import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pick, type Channel, type Lang } from '../../lib/civic/data.ts'
import type { Duration } from '../../lib/civic/lexicon.ts'
import { LANGUAGES } from '../../i18n.ts'
import { composeLetter, type LetterFields } from '../../lib/letter/compose.ts'
import { checkPolish, factTokens, splitParagraphs } from '../../lib/letter/polish.ts'
import { blocking, validateLetter } from '../../lib/letter/validate.ts'
import { categoryById } from '../../lib/civic/data.ts'
import type { Gateway } from '../../lib/rag/ask.ts'
import { IconAlert, IconCheck, IconCopy, IconDownload, IconExternal } from '../icons.tsx'
import { Status } from '../ui.tsx'

export interface LetterSeed {
  authority: string
  department: string | null
  category: string
  description: string
  descriptionLanguage: Lang | null
  location: string
  landmark?: string | null
  since?: Duration | null
  previous_reference?: string | null
  programme?: { id: number; name: string; page: number } | null
  complaint_id?: string
}

type Editable = Omit<LetterFields, 'date' | 'authority' | 'department' | 'category' | 'description' | 'body_override' | 'programme'> & { include_programme: boolean; attachments_text: string; impact: string }

export default function LetterBuilder({ seed, gateway, aiAvailable, onLetter, channel }: { seed: LetterSeed; gateway: Gateway | null; aiAvailable: boolean; onLetter?: (text: string) => void; channel?: Channel | null }) {
  const { t, i18n } = useTranslation()
  const [f, setF] = useState<Editable>(() => ({
    language: (i18n.language as Lang) ?? 'en',
    sender_name: '',
    sender_address: '',
    sender_phone: '',
    sender_email: '',
    location: seed.location,
    landmark: seed.landmark ?? '',
    since: seed.since ?? null,
    ongoing: true,
    impact: '',
    previous_reference: seed.previous_reference ?? '',
    requested_action: '',
    attachments_text: '',
    include_programme: false,
  }))
  const [bodyOverride, setBodyOverride] = useState<string[] | null>(null)
  const [edited, setEdited] = useState<string | null>(null)
  const [busy, setBusy] = useState<'polish' | 'pdf' | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [allowNoName, setAllowNoName] = useState(false)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'details' | 'preview'>('details')

  const cat = categoryById.get(seed.category) ?? categoryById.get('other')!
  const defaultAction = pick(cat.requested_action, f.language)

  const fields: LetterFields = useMemo(
    () => ({
      ...f,
      date: new Date(),
      authority: seed.authority,
      department: seed.department,
      category: seed.category,
      description: seed.description,
      requested_action: f.requested_action || undefined,
      attachments: f.attachments_text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
      programme: f.include_programme ? (seed.programme ?? null) : null,
      body_override: bodyOverride,
      complaint_id: seed.complaint_id,
    }),
    [f, seed, bodyOverride],
  )
  const composed = useMemo(() => composeLetter(fields), [fields])
  const text = edited ?? composed.text
  useEffect(() => onLetter?.(text), [text, onLetter])

  const issues = useMemo(
    () => validateLetter(text, { location: f.location, hasRecipient: Boolean(composed.recipient.office), senderName: f.sender_name, allowedSchemeIds: fields.programme ? [fields.programme.id] : [] }),
    [text, f.location, f.sender_name, composed.recipient.office, fields.programme],
  )
  const hasErrors = blocking(issues)
  const missingName = issues.some((i) => i.code === 'missing_name')
  const canExport = !hasErrors && (!missingName || allowNoName)

  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    setBodyOverride(null)
  }

  async function polish() {
    if (!gateway) return
    setBusy('polish')
    setNote(null)
    try {
      const template = composeLetter({ ...fields, body_override: null }).body
      const r = await gateway('polish', { body: template, language: f.language })
      const polished = splitParagraphs(r.text)
      const facts = factTokens(template, [f.location, f.landmark ?? '', f.previous_reference ?? ''].filter(Boolean))
      const check = checkPolish(template, polished.join('\n\n'), facts)
      if (check.ok) {
        setBodyOverride(polished)
        setEdited(null)
        setNote({ kind: 'ok', text: t('letter.polish_ok') })
      } else {
        setNote({ kind: 'warn', text: t('letter.polish_rejected', { missing: [...check.missing, ...check.added_numbers].join(', ') || '—' }) })
      }
    } catch {
      setNote({ kind: 'warn', text: t('letter.ai_unavailable') })
    } finally {
      setBusy(null)
    }
  }

  async function downloadPdf() {
    setBusy('pdf')
    setNote(null)
    try {
      const [{ letterPdf }, { loadPdfFonts }] = await Promise.all([import('../../lib/letter/pdf.ts'), import('../../lib/letter/fonts.ts')])
      const bytes = await letterPdf({ text, title: composed.subject, language: f.language }, await loadPdfFonts())
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `complaint-letter-${seed.complaint_id ?? new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      setNote({ kind: 'error', text: t('letter.pdf_failed', { error: (e as Error).message }) })
    } finally {
      setBusy(null)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      ;(document.getElementById('letter-text') as HTMLTextAreaElement | null)?.select()
      setNote({ kind: 'warn', text: t('letter.copy_failed') })
    }
  }

  const languageMismatch = seed.descriptionLanguage && seed.descriptionLanguage !== f.language

  return (
    <>
      <div className="doc-tabs" role="tablist" aria-label={t('letter.preview')}>
        {(['details', 'preview'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
            {t(v === 'details' ? 'letter.tab_details' : 'letter.tab_preview')}
          </button>
        ))}
      </div>
      <div className="doc-layout" data-view={view}>
        <div className="doc-form card">
        <section className="form-section">
          <h2>{t('letter.details')}</h2>
          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="l-lang">
                {t('letter.language')}
              </label>
              <select id="l-lang" value={f.language} onChange={(e) => set('language', e.target.value as Lang)}>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} lang={l.code}>
                    {l.native}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="l-loc">
                {t('letter.location')}
              </label>
              <input id="l-loc" className="input" value={f.location} onChange={(e) => set('location', e.target.value)} maxLength={120} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="l-lm">
                {t('letter.landmark')}
              </label>
              <input id="l-lm" className="input" value={f.landmark ?? ''} onChange={(e) => set('landmark', e.target.value)} maxLength={120} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="l-since">
                {t('letter.since_days')}
              </label>
              <input
                id="l-since"
                className="input"
                type="number"
                min={0}
                max={3650}
                value={f.since ? (f.since.unit === 'week' ? f.since.value * 7 : f.since.unit === 'month' ? f.since.value * 30 : f.since.value) : ''}
                onChange={(e) => set('since', e.target.value ? { value: Math.max(0, Number(e.target.value)), unit: 'day' } : null)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="l-ref">
                {t('letter.previous_reference')}
              </label>
              <input id="l-ref" className="input" value={f.previous_reference ?? ''} onChange={(e) => set('previous_reference', e.target.value)} maxLength={60} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="l-att">
                {t('letter.attachments')}
              </label>
              <textarea id="l-att" rows={2} style={{ minHeight: 64 }} value={f.attachments_text} onChange={(e) => set('attachments_text', e.target.value)} placeholder={t('letter.attachments_placeholder')} maxLength={300} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="l-impact">
              {t('letter.impact')}
            </label>
            <textarea id="l-impact" rows={2} style={{ minHeight: 64 }} value={f.impact} onChange={(e) => set('impact', e.target.value)} placeholder={t('letter.impact_placeholder')} maxLength={500} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="l-action">
              {t('letter.requested_action')}
            </label>
            <input id="l-action" className="input" value={f.requested_action} onChange={(e) => set('requested_action', e.target.value)} placeholder={defaultAction} maxLength={200} />
          </div>
          {seed.programme && (
            <label className="radio-card" style={{ marginBottom: 8 }}>
              <input type="checkbox" checked={f.include_programme} onChange={(e) => set('include_programme', e.target.checked)} />
              <span>{t('letter.include_programme', { name: seed.programme.name, id: seed.programme.id })}</span>
            </label>
          )}
        </section>

        <section className="form-section">
          <h2>{t('letter.sender')}</h2>
          <p className="hint">{t('letter.sender_privacy')}</p>
          <div className="grid-2">
            {(['sender_name', 'sender_address', 'sender_phone', 'sender_email'] as const).map((k) => (
              <div className="field" key={k}>
                <label className="field-label" htmlFor={`l-${k}`}>
                  {t(`letter.${k}`)}
                </label>
                <input id={`l-${k}`} className="input" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} maxLength={k === 'sender_address' ? 200 : 80} autoComplete={k === 'sender_name' ? 'name' : k === 'sender_phone' ? 'tel' : k === 'sender_email' ? 'email' : 'street-address'} />
              </div>
            ))}
          </div>
        </section>
        </div>

        <aside className="doc-aside">
          <div className="doc-toolbar">
            <h2>{t('letter.preview')}</h2>
            <span className="badge badge-outline mono">{composed.version}</span>
          </div>
          {languageMismatch && <Status kind="info">{t('letter.language_mismatch')}</Status>}
          <div className="doc-desk">
            <div className="doc-page">
              <label htmlFor="letter-text" className="sr-only">
                {t('letter.preview')}
              </label>
              <textarea id="letter-text" className="letter-paper" lang={f.language} value={text} onChange={(e) => setEdited(e.target.value)} spellCheck={false} />
              <span className="doc-page-label" aria-hidden>
                {t('letter.page_label')}
              </span>
            </div>
          </div>
          <p className="hint" style={{ margin: '10px 0 0' }}>
            {t('letter.edit_hint')}{' '}
            {edited !== null && (
              <button className="btn-ghost" onClick={() => setEdited(null)}>
                {t('letter.rebuild')}
              </button>
            )}
          </p>
          {issues.length > 0 ? (
            <ul className="checks">
              {issues.map((i) => (
                <li key={i.code + (i.detail ?? '')} className={i.level === 'error' ? 'error' : 'warn'}>
                  <IconAlert /> {t(`letter.issue.${i.code}`, { detail: i.detail ?? '' })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ok small" style={{ marginTop: 12 }}>
              <IconCheck /> {t('letter.checks_passed')}
            </p>
          )}
          {missingName && (
            <label className="radio-card" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={allowNoName} onChange={(e) => setAllowNoName(e.target.checked)} />
              <span className="small">{t('letter.allow_no_name')}</span>
            </label>
          )}
          {note && <Status kind={note.kind === 'error' ? 'error' : note.kind === 'ok' ? 'ok' : 'warn'}>{note.text}</Status>}
          <div className="actions">
            <button onClick={downloadPdf} disabled={!canExport || busy !== null}>
              <IconDownload /> {busy === 'pdf' ? t('letter.making_pdf') : t('letter.download_pdf')}
            </button>
            <button className="btn-secondary" onClick={copy} disabled={!canExport}>
              <IconCopy /> {copied ? t('letter.copied') : t('letter.copy')}
            </button>
            {aiAvailable && gateway && (
              <button className="btn-ghost" onClick={polish} disabled={busy !== null}>
                {busy === 'polish' ? t('letter.polishing') : t(languageMismatch ? 'letter.polish_translate' : 'letter.polish')}
              </button>
            )}
          </div>
          {channel && (
            <div className="source-block" style={{ marginTop: 16 }}>
              <IconExternal />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{pick(channel.label, f.language)}</div>
                <a href={channel.href} {...(channel.href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  {t('letter.open_portal')}
                </a>
              </div>
            </div>
          )}
          <p className="hint" style={{ marginTop: 12 }}>
            {t('letter.form_note')}
          </p>
        </aside>
      </div>
    </>
  )
}
