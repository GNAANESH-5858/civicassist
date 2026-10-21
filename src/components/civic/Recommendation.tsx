import { motion } from 'motion/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { categoryById, ESCALATION, pick } from '../../lib/civic/data.ts'
import type { ComplaintFrame } from '../../lib/civic/frame.ts'
import { categoryLabel, renderMessage } from '../../lib/civic/messages.ts'
import { buildPlan } from '../../lib/civic/plan.ts'
import { route, type Answers } from '../../lib/civic/routing.ts'
import { currentLang } from '../../i18n.ts'
import { IconAlert } from '../icons.tsx'
import ChannelCard from './ChannelCard.tsx'

export function SafetyPanel({ frame, answers }: { frame: ComplaintFrame; answers: Answers }) {
  const { t } = useTranslation()
  const routing = useMemo(() => route(frame, answers), [frame, answers])
  if (!routing.emergency.length) return null
  const urgent = frame.safety !== 'emergency' && answers.danger !== 'yes'
  return (
    <section className={`safety ${urgent ? 'urgent' : ''}`} role="alert">
      <h2>
        <IconAlert /> {t(urgent ? 'guidance:safety.urgent_title' : 'guidance:safety.emergency_title')}
      </h2>
      <p>{t(urgent ? 'guidance:safety.urgent_body' : 'guidance:safety.emergency_body')}</p>
      <ul className="list">
        {frame.hazards.map((h) => (
          <li key={h.id}>{t(`guidance:hazard.${h.id}`)}</li>
        ))}
      </ul>
      <div className="stack" style={{ marginTop: 12 }}>
        {routing.emergency.map((c) => (
          <ChannelCard key={c.id} channel={c} showInstructions={false} />
        ))}
      </div>
    </section>
  )
}

/** Authority, reasons, uncertainty, plan, submission channels and escalation for a complaint. */
export default function Recommendation({ frame, answers, onChangeCategory }: { frame: ComplaintFrame; answers: Answers; onChangeCategory?: () => void }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const routing = useMemo(() => route(frame, answers), [frame, answers])
  const plan = useMemo(() => buildPlan(frame, routing, answers), [frame, routing, answers])
  const cat = categoryById.get(routing.category)!

  return (
    <div className="stack">
      <SafetyPanel frame={frame} answers={answers} />

      <motion.section className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="authority-head">
          <div>
            <div className="eyebrow">{t('report.likely_authority')}</div>
            <p className="authority-name" lang="en">
              {routing.authority.name}
            </p>
            <p className="hint">{pick(routing.authority.explain, lang)}</p>
          </div>
          <span className={`badge ${routing.confidence === 'high' ? 'badge-ok' : routing.confidence === 'medium' ? 'badge-brand' : 'badge-warn'}`}>{t('report.confidence', { level: t(`guidance:confidence.${routing.confidence}`) })}</span>
        </div>
        <div className="facts" style={{ marginTop: 12 }}>
          <div className="fact">
            <div className="fact-label">{t('report.category')}</div>
            <div className="fact-value">{pick(cat.label, lang)}</div>
            {onChangeCategory && (
              <button className="btn-ghost" onClick={onChangeCategory}>
                {t('report.change_category')}
              </button>
            )}
          </div>
          {routing.department && (
            <div className="fact">
              <div className="fact-label">{t('report.department')}</div>
              <div className="fact-value" lang="en">
                {routing.department}
              </div>
            </div>
          )}
        </div>

        <h3>{t('report.why')}</h3>
        <ul className="list">
          {routing.reasons.map((r, i) => (
            <li key={i}>{renderMessage(r, lang, t)}</li>
          ))}
        </ul>

        {routing.uncertainties.length > 0 && (
          <>
            <h3>{t('report.uncertain')}</h3>
            <ul className="list">
              {routing.uncertainties.map((u, i) => (
                <li key={i}>{renderMessage(u, lang, t)}</li>
              ))}
            </ul>
          </>
        )}

        {routing.alternatives.length > 0 && (
          <>
            <h3>{t('report.alternatives')}</h3>
            <ul className="list">
              {routing.alternatives.map((a) => (
                <li key={a.authority.id}>
                  <strong lang="en">{a.authority.name}</strong>: {pick(a.when, lang)}
                </li>
              ))}
            </ul>
          </>
        )}
      </motion.section>

      <section className="card">
        <h2>{t('report.plan_title')}</h2>
        <ol className="plan">
          {plan.map((s) => (
            <li key={s.id}>{renderMessage(s, lang, t)}</li>
          ))}
        </ol>
        <p className="hint">{t('report.suggestion_note')}</p>
      </section>

      <section className="card" id="where-to-submit">
        <h2>{t('report.where_to_submit')}</h2>
        <p className="hint">{t('report.where_to_submit_note', { authority: routing.authority.name })}</p>
        {routing.channels.length ? (
          <div className="stack">
            {routing.channels.map((c, i) => (
              <ChannelCard key={c.id} channel={c} primary={i === 0} />
            ))}
          </div>
        ) : (
          <p>{t('guidance:uncertain.no_channel', { authority: routing.authority.name })}</p>
        )}
        {routing.authority.website && (
          <p style={{ marginTop: 12 }}>
            <a href={routing.authority.website} target="_blank" rel="noopener noreferrer">
              {t('guidance:channel_action.website')}
            </a>
          </p>
        )}
      </section>

      <section className="card subtle">
        <h2>{t('report.follow_up_title')}</h2>
        <ul className="list">
          {pick(ESCALATION.general_follow_up, lang).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {routing.escalation.length > 0 && (
          <>
            <h3>{t('report.escalation_title')}</h3>
            <ol className="list">
              {routing.escalation.map((e) => (
                <li key={e.channel.id}>
                  {pick(e.text, lang)}{' '}
                  {e.channel.href.startsWith('https://') ? (
                    <a href={e.channel.href} target="_blank" rel="noopener noreferrer">
                      {pick(e.channel.label, lang)}
                    </a>
                  ) : (
                    <a href={e.channel.href}>{e.channel.value}</a>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="hint">{pick(ESCALATION.timeline_note, lang)}</p>
      </section>
      <p className="hint">{t('report.category_label_note', { category: categoryLabel(routing.category, lang) })}</p>
    </div>
  )
}
