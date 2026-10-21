import { useTranslation } from 'react-i18next'
import { pick, type Channel } from '../../lib/civic/data.ts'
import { currentLang } from '../../i18n.ts'
import { IconExternal, IconMail, IconPhone } from '../icons.tsx'
import { VerificationBadge } from '../ui.tsx'

/** Opens only verified official destinations (from the knowledge base) in a new tab or app. */
export default function ChannelCard({ channel, primary = false, showInstructions = true }: { channel: Channel; primary?: boolean; showInstructions?: boolean }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const external = channel.href.startsWith('https://')
  const actionKey = channel.kind === 'phone' ? 'call' : channel.kind
  return (
    <div className={`channel ${primary ? 'primary' : ''}`}>
      <div className="channel-head">
        <div>
          <div className="channel-name">{pick(channel.label, lang)}</div>
          <div className="hint">
            {t(`guidance:channel_kind.${channel.kind}`)}
            {channel.value ? ` · ${channel.value}` : ''}
          </div>
        </div>
        {primary && <span className="badge badge-brand">{t('report.recommended_channel')}</span>}
      </div>
      <div className="actions" style={{ marginTop: 10 }}>
        <a className={primary ? 'btn' : 'btn btn-secondary'} href={channel.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {channel.kind === 'phone' ? <IconPhone /> : channel.kind === 'email' ? <IconMail /> : <IconExternal />}
          {t(`guidance:channel_action.${actionKey}`, { value: channel.value ?? '' })}
        </a>
        {channel.alternate && (
          <a className="btn btn-ghost" href={channel.alternate.href} {...(channel.alternate.href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {channel.alternate.value}
          </a>
        )}
      </div>
      {channel.requires.length > 0 && (
        <div className="meta">
          {channel.requires.map((r) => (
            <span key={r} className="pill">
              {t(`guidance:requires.${r}`)}
            </span>
          ))}
        </div>
      )}
      {showInstructions && (
        <ol>
          {pick(channel.instructions, lang).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      {lang !== 'en' && channel.kind === 'online_portal' && channel.portal_languages === 'unknown' && <p className="hint" style={{ marginTop: 8 }}>{t('guidance:portal_language_unknown')}</p>}
      <VerificationBadge status={channel.status} source={channel.source} />
    </div>
  )
}
