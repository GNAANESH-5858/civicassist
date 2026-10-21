import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import ChannelCard from '../components/civic/ChannelCard.tsx'
import { CategoryPicker, QuestionField } from '../components/civic/QuestionField.tsx'
import Recommendation, { SafetyPanel } from '../components/civic/Recommendation.tsx'
import { IconCheck, IconCopy, IconSave } from '../components/icons.tsx'
import LetterBuilder from '../components/letter/LetterBuilder.tsx'
import { PageHeader, SchemeCard, Status } from '../components/ui.tsx'
import { currentLang } from '../i18n.ts'
import { aiMarkedUnavailable, guarded, makeExtractor } from '../lib/browser/ai.ts'
import { makeGateway } from '../lib/browser/gateway.ts'
import { privateLink, recordsApi, rememberRecord } from '../lib/browser/records.ts'
import { recentForTriage, loadHistory, saveComplaint } from '../lib/browser/storage.ts'
import { assistFrame } from '../lib/civic/assist.ts'
import { categoryById, pick } from '../lib/civic/data.ts'
import { buildFrame } from '../lib/civic/frame.ts'
import { categoryLabel } from '../lib/civic/messages.ts'
import { nextQuestions } from '../lib/civic/questions.ts'
import { route, type Answers } from '../lib/civic/routing.ts'
import { glossQuery } from '../lib/civic/schemeGloss.ts'
import { emptyReport, loadReport, saveReport, STEPS, stepEnabled, type ReportState, type Step } from '../lib/civic/session.ts'
import type { TriageResult } from '../lib/nlp/triage.ts'
import type { RelevantRecord } from '../lib/rag/relevant.ts'

const QUICK = ['roads', 'garbage', 'drainage_flooding', 'water_supply', 'streetlight', 'sewage', 'electricity', 'traffic'] as const

function locationText(r: ReportState): string {
  const f = r.frame
  const parts = [r.answers.location, !r.answers.location ? f?.locality?.name : null, f?.ward ? `Ward ${f.ward}` : null].filter(Boolean)
  return parts.join(', ')
}

export default function ReportPage() {
  const { t } = useTranslation()
  const lang = currentLang()
  const [params, setParams] = useSearchParams()
  const [r, setR] = useState<ReportState>(() => loadReport())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const gateway = useMemo(() => guarded(makeGateway()), [])
  const [aiAvailable, setAiAvailable] = useState(() => !aiMarkedUnavailable())

  const update = useCallback((patch: Partial<ReportState>) => {
    setR((prev) => {
      const next = { ...prev, ...patch }
      saveReport(next)
      return next
    })
  }, [])

  // Prefill from the home page ("/report?text=...&category=...").
  useEffect(() => {
    const text = params.get('text')
    const category = params.get('category')
    if (text || category) {
      const fresh = { ...emptyReport(), text: text ?? '', userCategory: category && categoryById.has(category) ? category : null }
      setR(fresh)
      saveReport(fresh)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  useEffect(() => {
    document.getElementById('main')?.scrollIntoView({ block: 'start' })
  }, [r.step])

  async function analyse() {
    setBusy(true)
    setError(null)
    let triage: TriageResult | null = null
    try {
      const res = await fetch('/api/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: r.text, recent: recentForTriage(loadHistory()) }) })
      if (res.ok) triage = (await res.json()) as TriageResult
    } catch {
      // Triage service unreachable: the browser-side rules still work.
    }
    const extractor = aiAvailable ? makeExtractor(gateway) : null
    const frame = await assistFrame(r.text, { triageDepartment: triage?.department ?? null, userCategory: r.userCategory }, extractor)
    if (frame.ai_error) setAiAvailable(false)
    if (triage && !triage.error) saveComplaint({ complaint_id: triage.complaint_id, created_at: new Date().toISOString(), result: triage })
    update({ frame, triageDepartment: triage?.department ?? null, complaintId: triage?.complaint_id ?? null, answers: {}, step: 'clarify', submitted: null, savedRecordId: null })
    setBusy(false)
  }

  function setCategory(id: string) {
    if (!r.frame) return
    const rebuilt = buildFrame(r.text, { triageDepartment: r.triageDepartment, userCategory: id })
    update({ userCategory: id, frame: { ...r.frame, ...rebuilt, ai_used: r.frame.ai_used, ai_fields: r.frame.ai_fields.filter((f) => f !== 'category'), english_summary: r.frame.english_summary, ai_error: null } })
  }

  const go = (step: Step) => update({ step })
  const routing = useMemo(() => (r.frame ? route(r.frame, r.answers) : null), [r.frame, r.answers])

  return (
    <>
      <PageHeader eyebrow={t('report.eyebrow')} title={t('report.title')}>
        {t('report.intro')}
      </PageHeader>

      <nav aria-label={t('report.steps_label')}>
        <ol className="stepper">
          {STEPS.map((s, i) => (
            <li key={s} className={`${r.step === s ? 'current' : ''} ${STEPS.indexOf(r.step) > i ? 'done' : ''}`}>
              <button type="button" disabled={!stepEnabled(r, s)} aria-current={r.step === s ? 'step' : undefined} onClick={() => go(s)}>
                <span className="num">{STEPS.indexOf(r.step) > i ? <IconCheck size={12} /> : i + 1}</span>
                {t(`report.step.${s}`)}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {!aiAvailable && r.step !== 'describe' && <Status kind="info">{t('common.ai_unavailable_notice')}</Status>}
      {error && <Status kind="error">{error}</Status>}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={r.step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
          {r.step === 'describe' && (
            <section className="card">
              <label htmlFor="describe" className="field-label">
                {t('report.describe_label')}
              </label>
              <textarea id="describe" rows={5} value={r.text} onChange={(e) => update({ text: e.target.value })} placeholder={t('report.describe_placeholder')} maxLength={2000} />
              <p className="hint">{t('report.describe_hint')}</p>
              <h3>{t('report.quick_label')}</h3>
              <div className="chips">
                {QUICK.map((id) => (
                  <button key={id} type="button" className="chip" aria-pressed={r.userCategory === id} onClick={() => update({ userCategory: r.userCategory === id ? null : id })}>
                    {categoryLabel(id, lang)}
                  </button>
                ))}
              </div>
              <div className="actions">
                <button onClick={analyse} disabled={busy || r.text.trim().length < 5}>
                  {busy ? t('report.analysing') : t('report.continue')}
                </button>
                {r.text && (
                  <button className="btn-ghost" onClick={() => update(emptyReport())}>
                    {t('report.start_over')}
                  </button>
                )}
              </div>
              <p className="hint">{t('report.privacy_note')}</p>
            </section>
          )}

          {r.step === 'clarify' && r.frame && (
            <div className="stack">
              <SafetyPanel frame={r.frame} answers={r.answers} />
              <section className="card">
                <h2>{t('report.understood')}</h2>
                <div className="facts">
                  <Fact label={t('report.category')} value={categoryLabel(r.frame.category, lang)} origin={r.frame.category_source === 'ai' ? t('report.origin_ai') : r.frame.category_source === 'user' ? t('report.origin_you') : t('report.origin_rules')} />
                  <Fact label={t('report.location')} value={locationText(r) || t('common.not_given')} origin={r.frame.ai_fields.includes('locality') ? t('report.origin_ai') : undefined} />
                  <Fact label={t('report.landmark')} value={r.answers.landmark || r.frame.landmark || t('common.not_given')} />
                  <Fact label={t('report.duration')} value={r.frame.duration ? t('report.duration_value', { value: r.frame.duration.value, unit: t(`common.unit.${r.frame.duration.unit}`, { count: r.frame.duration.value }) }) : t('common.not_given')} origin={r.frame.ai_fields.includes('duration') ? t('report.origin_ai') : undefined} />
                </div>
                {r.frame.language && <p className="hint" style={{ marginTop: 10 }}>{t('report.language_detected', { language: t(`common.language.${r.frame.language}`) })}{r.frame.mixed_language ? ` ${t('report.mixed')}` : ''}</p>}
                {r.frame.pii_masked && <p className="hint">{t('report.pii_masked')}</p>}
                <h3>{r.frame.confidence === 'low' ? t('report.pick_category_low') : t('report.pick_category')}</h3>
                <CategoryPicker candidates={r.frame.candidates.map((c) => c.id)} selected={r.frame.category} onPick={setCategory} />
              </section>

              <QuestionsBlock frame={r.frame} answers={r.answers} onAnswers={(answers) => update({ answers })} />

              <div className="actions">
                <button className="btn-secondary" onClick={() => go('describe')}>
                  {t('common.back')}
                </button>
                <button onClick={() => go('recommend')}>{t('report.see_recommendation')}</button>
              </div>
            </div>
          )}

          {r.step === 'recommend' && r.frame && (
            <div className="stack">
              <Recommendation frame={r.frame} answers={r.answers} onChangeCategory={() => go('clarify')} />
              <RelatedSchemes frame={r.frame} />
              <div className="actions">
                <button className="btn-secondary" onClick={() => go('clarify')}>
                  {t('common.back')}
                </button>
                <button onClick={() => go('letter')}>{t('report.prepare_letter')}</button>
                <button className="btn-secondary" onClick={() => go('submit')}>
                  {t('report.skip_letter')}
                </button>
              </div>
            </div>
          )}

          {r.step === 'letter' && r.frame && routing && (
            <div className="stack">
              <LetterBuilder
                aiAvailable={aiAvailable}
                gateway={gateway}
                seed={{
                  authority: routing.authority.id,
                  department: routing.department,
                  category: routing.category,
                  description: r.frame.text,
                  descriptionLanguage: r.frame.language,
                  location: locationText(r),
                  landmark: r.answers.landmark ?? r.frame.landmark,
                  since: r.frame.duration,
                  previous_reference: r.answers.previous_complaint ?? r.frame.previous_reference,
                  complaint_id: r.complaintId ?? undefined,
                }}
              />
              <div className="actions">
                <button className="btn-secondary" onClick={() => go('recommend')}>
                  {t('common.back')}
                </button>
                <button onClick={() => go('submit')}>{t('report.go_submit')}</button>
              </div>
            </div>
          )}

          {r.step === 'submit' && r.frame && routing && <SubmitStep r={r} onDone={(submitted) => update({ submitted, step: 'track' })} onBack={() => go('letter')} />}

          {r.step === 'track' && r.frame && routing && <TrackStep r={r} onSaved={(id) => update({ savedRecordId: id })} />}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

function Fact({ label, value, origin }: { label: string; value: string; origin?: string }) {
  return (
    <div className="fact">
      <div className="fact-label">{label}</div>
      <div className="fact-value">{value}</div>
      {origin && <div className="origin">{origin}</div>}
    </div>
  )
}

function QuestionsBlock({ frame, answers, onAnswers }: { frame: NonNullable<ReportState['frame']>; answers: Answers; onAnswers: (a: Answers) => void }) {
  const { t } = useTranslation()
  const [skipped, setSkipped] = useState<string[]>([])
  const qs = nextQuestions(frame, answers, 4).filter((q) => !skipped.includes(q.id))
  const answered = Object.entries(answers).filter(([, v]) => v !== undefined)
  return (
    <section className="card">
      <h2>{t('report.questions_title')}</h2>
      <p className="hint">{t('report.questions_hint')}</p>
      {answered.length > 0 && (
        <ul className="list" style={{ marginBottom: 12 }}>
          {answered.map(([k, v]) => (
            <li key={k}>
              {t(`guidance:question.${k}.short`)}: <strong>{['yes', 'no', 'unknown'].includes(v as string) ? t(`guidance:yesno.${v}`) : t(`guidance:question.${k}.option.${v}`, { defaultValue: v as string })}</strong>{' '}
              <button
                className="btn-ghost"
                onClick={() => {
                  const next = { ...answers }
                  delete next[k as keyof Answers]
                  onAnswers(next)
                }}
              >
                {t('common.change')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {qs.length ? (
        <div className="stack">
          {qs.map((q) => (
            <QuestionField key={q.id} id={q.id} onAnswer={(v) => onAnswers({ ...answers, [q.id]: v })} onSkip={() => setSkipped([...skipped, q.id])} />
          ))}
        </div>
      ) : (
        <p className="ok small">
          <IconCheck /> {t('report.no_more_questions')}
        </p>
      )}
    </section>
  )
}

function RelatedSchemes({ frame }: { frame: NonNullable<ReportState['frame']> }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [items, setItems] = useState<RelevantRecord[]>([])
  async function load() {
    setState('loading')
    try {
      const query = frame.language === 'en' ? frame.text : frame.english_summary || glossQuery(frame.text)
      if (!query.trim()) {
        setItems([])
        setState('done')
        return
      }
      const [{ loadKb }, { findRelevant }] = await Promise.all([import('../lib/browser/kb.ts'), import('../lib/rag/relevant.ts')])
      setItems(await findRelevant(query, await loadKb()))
      setState('done')
    } catch {
      setState('error')
    }
  }
  return (
    <section className="card subtle">
      <h2>{t('report.schemes_title')}</h2>
      <p className="hint">{t('report.schemes_hint')}</p>
      {state === 'idle' && (
        <button className="btn-secondary" onClick={load}>
          {t('report.schemes_check')}
        </button>
      )}
      {state === 'loading' && <Status kind="loading">{t('schemes.loading_model')}</Status>}
      {state === 'error' && <Status kind="error">{t('schemes.load_error')}</Status>}
      {state === 'done' && (items.length ? <div className="scheme-list">{items.map((x) => <SchemeCard key={x.record.id} record={x.record} score={x.score} boost={x.boost} match={x.match} />)}</div> : <Status kind="empty">{t('report.schemes_none')}</Status>)}
    </section>
  )
}

function SubmitStep({ r, onDone, onBack }: { r: ReportState; onDone: (s: NonNullable<ReportState['submitted']>) => void; onBack: () => void }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const routing = route(r.frame!, r.answers)
  const [reference, setReference] = useState(r.submitted?.reference ?? '')
  const [channel, setChannel] = useState(r.submitted?.channel_id ?? routing.primary?.id ?? '')
  const [date, setDate] = useState(r.submitted?.date ?? new Date().toISOString().slice(0, 10))
  const [copied, setCopied] = useState<string | null>(null)
  const details: [string, string][] = [
    [t('report.category'), categoryLabel(routing.category, lang)],
    [t('report.location'), locationText(r)],
    [t('report.landmark'), r.answers.landmark ?? r.frame?.landmark ?? ''],
    [t('report.duration'), r.frame?.duration ? t('report.duration_value', { value: r.frame.duration.value, unit: t(`common.unit.${r.frame.duration.unit}`, { count: r.frame.duration.value }) }) : ''],
    [t('report.description'), r.frame?.text.replace(/\s*\[(PHONE|ID|EMAIL)\]/g, '') ?? ''],
  ].filter(([, v]) => v) as [string, string][]
  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }
  return (
    <div className="stack">
      <Status kind="info">{t('report.submit_notice')}</Status>
      <section className="card">
        <h2>{t('report.submit_open')}</h2>
        <p className="hint">{t('report.submit_open_hint', { authority: routing.authority.name })}</p>
        <div className="stack">
          {routing.channels.slice(0, 3).map((c, i) => (
            <ChannelCard key={c.id} channel={c} primary={i === 0} />
          ))}
        </div>
      </section>
      <section className="card">
        <h2>{t('report.submit_details')}</h2>
        <p className="hint">{t('report.submit_details_hint')}</p>
        <div className="stack">
          {details.map(([label, value]) => (
            <div key={label} className="fact" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div className="fact-label">{label}</div>
                <div>{value}</div>
              </div>
              <button className="btn-ghost" onClick={() => copy(label, value)} aria-label={t('report.copy_field', { field: label })}>
                <IconCopy /> {copied === label ? t('letter.copied') : t('common.copy')}
              </button>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          {t('report.pdf_note')}
        </p>
      </section>
      <section className="card">
        <h2>{t('report.after_submit')}</h2>
        <div className="grid-2">
          <div className="field">
            <label className="field-label" htmlFor="s-ref">
              {t('report.reference')}
            </label>
            <input id="s-ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} placeholder={t('report.reference_placeholder')} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="s-date">
              {t('report.submitted_on')}
            </label>
            <input id="s-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="s-ch">
              {t('report.channel_used')}
            </label>
            <select id="s-ch" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {routing.channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {pick(c.label, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btn-secondary" onClick={onBack}>
            {t('common.back')}
          </button>
          <button onClick={() => onDone({ status: 'submitted_externally', channel_id: channel || null, reference: reference.trim(), date })}>{t('report.i_submitted')}</button>
          <button className="btn-secondary" onClick={() => onDone({ status: 'ready_to_submit', channel_id: channel || null, reference: '', date: '' })}>
            {t('report.later')}
          </button>
        </div>
      </section>
    </div>
  )
}

function TrackStep({ r, onSaved }: { r: ReportState; onSaved: (id: string) => void }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const routing = route(r.frame!, r.answers)
  const [followUp, setFollowUp] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(r.savedRecordId ? 'saved' : 'idle')
  const [link, setLink] = useState<string | null>(null)
  const status = r.submitted?.status ?? 'ready_to_submit'

  async function save() {
    setState('saving')
    try {
      const { id, token } = await recordsApi.create({
        title: `${categoryLabel(routing.category, 'en')} - ${locationText(r) || 'Chennai'}`.slice(0, 120),
        summary: r.frame!.text.slice(0, 2000),
        language: lang,
        category: routing.category,
        authority: routing.authority.id,
        department: routing.department,
        channel_id: r.submitted?.channel_id ?? routing.primary?.id ?? null,
        locality: r.frame!.locality?.name ?? null,
        status,
        external_reference: r.submitted?.reference || null,
        submitted_on: r.submitted?.date || null,
        follow_up_on: followUp || null,
        notes: null,
      })
      rememberRecord({ id, token, title: `${categoryLabel(routing.category, lang)} · ${locationText(r)}`, saved_at: new Date().toISOString() })
      setLink(privateLink(window.location.origin, { id, token }))
      onSaved(id)
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>{t(`report.track_status_${status}`)}</h2>
        <p>{t(status === 'submitted_externally' ? 'report.track_submitted_body' : 'report.track_ready_body', { authority: routing.authority.name })}</p>
        {r.submitted?.reference && (
          <p>
            {t('report.reference')}: <strong className="mono">{r.submitted.reference}</strong>
          </p>
        )}
      </section>
      <section className="card">
        <h2>{t('report.save_title')}</h2>
        <p className="hint">{t('report.save_hint')}</p>
        <div className="field" style={{ maxWidth: 260 }}>
          <label className="field-label" htmlFor="t-fu">
            {t('report.follow_up_on')}
          </label>
          <input id="t-fu" className="input" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        </div>
        <p className="hint">{t('guidance:plan.no_timeline')}</p>
        {state !== 'saved' && (
          <button onClick={save} disabled={state === 'saving'}>
            <IconSave /> {state === 'saving' ? t('common.saving') : t('report.save_private')}
          </button>
        )}
        {state === 'error' && <Status kind="error">{t('report.save_failed')}</Status>}
        {state === 'saved' && (
          <Status kind="ok">
            {t('report.saved')} {link && <span className="mono">{link}</span>} <Link to="/my-complaints">{t('report.open_my_complaints')}</Link>
          </Status>
        )}
        {link && <p className="hint">{t('report.link_warning')}</p>}
      </section>
      <Recommendation frame={r.frame!} answers={r.answers} />
    </div>
  )
}
