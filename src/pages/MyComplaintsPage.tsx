import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { IconCopy, IconDownload } from '../components/icons.tsx'
import { PageHeader, Status } from '../components/ui.tsx'
import { forgetRecord, parsePrivateLink, privateLink, recordsApi, rememberRecord, savedRecords, type SavedRef } from '../lib/browser/records.ts'
import { authorityById } from '../lib/civic/data.ts'
import { categoryLabel } from '../lib/civic/messages.ts'
import { currentLang } from '../i18n.ts'
import { SETTABLE_STATUSES, type ComplaintRecord } from '../lib/records/schema.ts'

type Loaded = { ref: SavedRef; record: ComplaintRecord | null; error: string | null }

export default function MyComplaintsPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<Loaded[] | null>(null)
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // A private link opened on this device (#r=id.token) is remembered first.
    const fromHash = parsePrivateLink(window.location.hash)
    if (fromHash) {
      rememberRecord({ ...fromHash, title: '', saved_at: new Date().toISOString() })
      history.replaceState(null, '', window.location.pathname)
    }
    const refs = savedRecords()
    const loaded = await Promise.all(
      refs.map(async (ref) => {
        try {
          const { record } = await recordsApi.get(ref.id, ref.token)
          return { ref, record, error: null }
        } catch (e) {
          return { ref, record: null, error: (e as Error).message }
        }
      }),
    )
    setItems(loaded)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addFromLink() {
    const p = parsePrivateLink(paste)
    if (!p) return setPasteError(t('records.link_invalid'))
    try {
      const { record } = await recordsApi.get(p.id, p.token)
      rememberRecord({ ...p, title: record.title, saved_at: new Date().toISOString() })
      setPaste('')
      setPasteError(null)
      void load()
    } catch {
      setPasteError(t('records.link_not_found'))
    }
  }

  return (
    <>
      <PageHeader eyebrow={t('records.eyebrow')} title={t('records.title')}>
        {t('records.intro')}
      </PageHeader>
      <Status kind="info">{t('records.honesty')}</Status>

      {items === null && <Status kind="loading">{t('common.loading')}</Status>}
      {items && items.length === 0 && (
        <Status kind="empty">
          {t('records.empty')} <Link to="/report">{t('nav.report')}</Link>
        </Status>
      )}
      <div className="stack">
        {items?.map((it) => (
          <RecordCard
            key={it.ref.id}
            item={it}
            onChanged={(record) => setItems((xs) => xs!.map((x) => (x.ref.id === it.ref.id ? { ...x, record } : x)))}
            onDeleted={() => {
              forgetRecord(it.ref.id)
              setItems((xs) => xs!.filter((x) => x.ref.id !== it.ref.id))
            }}
          />
        ))}
      </div>

      <section className="card subtle" style={{ marginTop: 20 }}>
        <h2>{t('records.open_link_title')}</h2>
        <p className="hint">{t('records.open_link_hint')}</p>
        <div className="inline-form">
          <label htmlFor="paste-link" className="sr-only">
            {t('records.open_link_title')}
          </label>
          <input id="paste-link" className="input" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="https://…/my-complaints#r=…" />
          <button onClick={addFromLink} disabled={!paste.trim()}>
            {t('records.open')}
          </button>
        </div>
        {pasteError && <Status kind="error">{pasteError}</Status>}
      </section>
    </>
  )
}

function RecordCard({ item, onChanged, onDeleted }: { item: Loaded; onChanged: (r: ComplaintRecord) => void; onDeleted: () => void }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const r = item.record
  const [status, setStatus] = useState(r?.status ?? 'draft')
  const [reference, setReference] = useState(r?.external_reference ?? '')
  const [followUp, setFollowUp] = useState(r?.follow_up_on ?? '')
  const [notes, setNotes] = useState(r?.notes ?? '')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [copied, setCopied] = useState(false)

  if (!r) {
    return (
      <section className="card">
        <Status kind="error">{t('records.load_failed')}</Status>
        <button className="btn-danger" onClick={onDeleted}>
          {t('records.forget')}
        </button>
      </section>
    )
  }

  async function save() {
    setState('saving')
    try {
      const { record } = await recordsApi.update(item.ref.id, item.ref.token, {
        status: status as never,
        external_reference: reference || null,
        follow_up_on: followUp || null,
        notes: notes || null,
        ...(note.trim() ? { history_note: note.trim() } : {}),
      })
      onChanged(record)
      setNote('')
      setState('saved')
    } catch {
      setState('error')
    }
  }

  async function remove() {
    if (!window.confirm(t('records.confirm_delete'))) return
    try {
      await recordsApi.remove(item.ref.id, item.ref.token)
      onDeleted()
    } catch {
      setState('error')
    }
  }

  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `civicassist-complaint-${r!.id.slice(0, 8)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(privateLink(window.location.origin, item.ref))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="card">
      <div className="card-title">
        <div>
          <h2 style={{ marginBottom: 2 }}>{categoryLabel(r.category, lang)}</h2>
          <div className="hint" lang="en">
            {authorityById.get(r.authority)?.name ?? r.authority}
            {r.locality ? ` · ${r.locality}` : ''}
          </div>
        </div>
        <span className="badge badge-brand">{t(`records.status.${r.status}`)}</span>
      </div>
      <p className="hint">{r.summary}</p>
      <div className="grid-2">
        <div className="field">
          <label className="field-label" htmlFor={`st-${r.id}`}>
            {t('records.status_label')}
          </label>
          <select id={`st-${r.id}`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {SETTABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`records.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`ref-${r.id}`}>
            {t('report.reference')}
          </label>
          <input id={`ref-${r.id}`} className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`fu-${r.id}`}>
            {t('report.follow_up_on')}
          </label>
          <input id={`fu-${r.id}`} className="input" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`hn-${r.id}`}>
            {t('records.history_note')}
          </label>
          <input id={`hn-${r.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t('records.history_note_placeholder')} />
        </div>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`n-${r.id}`}>
          {t('records.notes')}
        </label>
        <textarea id={`n-${r.id}`} rows={2} style={{ minHeight: 64 }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </div>
      <p className="hint">{t('records.pii_hint')}</p>
      <div className="actions">
        <button onClick={save} disabled={state === 'saving'}>
          {state === 'saving' ? t('common.saving') : t('common.save')}
        </button>
        <button className="btn-secondary" onClick={copyLink}>
          <IconCopy /> {copied ? t('letter.copied') : t('records.copy_link')}
        </button>
        <button className="btn-secondary" onClick={exportJson}>
          <IconDownload /> {t('records.export')}
        </button>
        <button className="btn-danger" onClick={remove}>
          {t('records.delete')}
        </button>
      </div>
      {state === 'saved' && <Status kind="ok">{t('records.saved')}</Status>}
      {state === 'error' && <Status kind="error">{t('records.save_failed')}</Status>}
      <details>
        <summary>{t('records.history', { count: r.history.length })}</summary>
        <ol className="timeline">
          {[...r.history].reverse().map((h, i) => (
            <li key={i}>
              <strong>{t(`records.status.${h.status}`)}</strong> · {new Date(h.at).toLocaleString()} · <span className="hint">{t(h.by === 'admin' ? 'records.by_admin' : 'records.by_citizen')}</span>
              {h.note && <div>{h.note}</div>}
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}
