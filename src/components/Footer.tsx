import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { IconLogo } from './icons.tsx'

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="site-footer">
      <div className="container cols">
        <div>
          <Link to="/" className="brand" aria-label={t('brand.home_label')} style={{ marginBottom: 12 }}>
            <span className="brand-mark" aria-hidden>
              <IconLogo size={18} />
            </span>
            <span className="brand-name">CivicAssist</span>
          </Link>
          <p style={{ maxWidth: 420 }}>{t('footer.blurb')}</p>
          <p>
            <Link to="/about#sources">{t('footer.sources')}</Link>
          </p>
        </div>
        <div>
          <h2>{t('footer.official')}</h2>
          <ul>
            <li>
              <a href="https://www.chennaicorporation.gov.in/gcc/" target="_blank" rel="noopener noreferrer">
                Greater Chennai Corporation
              </a>
            </li>
            <li>
              <a href="https://cmwssb.tn.gov.in/" target="_blank" rel="noopener noreferrer">
                Chennai Metro Water (CMWSSB)
              </a>
            </li>
            <li>
              <a href="https://www.tnpdcl.org/" target="_blank" rel="noopener noreferrer">
                TNPDCL (electricity)
              </a>
            </li>
            <li>
              <a href="https://www.myscheme.gov.in/" target="_blank" rel="noopener noreferrer">
                myScheme
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2>{t('footer.project')}</h2>
          <ul>
            <li>
              <Link to="/about">{t('nav.about')}</Link>
            </li>
            <li>
              <Link to="/letter">{t('footer.letter')}</Link>
            </li>
            <li>
              <Link to="/about#sources">{t('footer.verification')}</Link>
            </li>
            <li>
              <Link to="/evaluation">{t('nav.evaluation')}</Link>
            </li>
            <li>
              <Link to="/officer">{t('nav.officer')}</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="independence container">{t('footer.independence')}</div>
    </footer>
  )
}
