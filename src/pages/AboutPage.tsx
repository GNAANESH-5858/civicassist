import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui.tsx'
import { SOURCES } from '../lib/civic/data.ts'

export default function AboutPage() {
  const { t } = useTranslation()
  const sections = ['what', 'independent', 'privacy', 'ai', 'languages', 'limits'] as const
  return (
    <>
      <PageHeader eyebrow={t('about.eyebrow')} title={t('about.title')}>
        {t('about.intro')}
      </PageHeader>
      <div className="stack">
        {sections.map((s) => (
          <section key={s} className="card">
            <h2>{t(`about.${s}.title`)}</h2>
            {(t(`about.${s}.body`, { returnObjects: true }) as string[]).map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
        <section className="card" id="sources">
          <h2>{t('about.sources.title')}</h2>
          <p className="hint">{t('about.sources.body')}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('about.sources.page')}</th>
                  <th>{t('about.sources.status')}</th>
                  <th>{t('about.sources.checked')}</th>
                </tr>
              </thead>
              <tbody>
                {SOURCES.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" lang="en">
                        {s.title}
                      </a>
                      {s.reason && (
                        <div className="hint" lang="en">
                          {s.reason}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'verified' ? 'badge-ok' : s.status === 'loads' ? 'badge-warn' : 'badge-bad'}`}>{t(`about.sources.s_${s.status}`)}</span>
                    </td>
                    <td className="mono">{s.checked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}
