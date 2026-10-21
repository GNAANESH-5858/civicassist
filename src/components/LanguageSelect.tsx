import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n.ts'

/** Language selector showing each language in its own script. */
export default function LanguageSelect({ id = 'site-language' }: { id?: string }) {
  const { t, i18n } = useTranslation()
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {t('nav.language')}
      </label>
      <select id={id} className="lang-select" value={i18n.language} onChange={(e) => void i18n.changeLanguage(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </>
  )
}
