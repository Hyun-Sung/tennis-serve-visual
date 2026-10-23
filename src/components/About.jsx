import { Trans, useTranslation } from 'react-i18next'

export const DONATE_URL = 'https://paypal.me/hyuns89'

// The sections of the explainer, in order; each has title, body, formula and note in about.<id>.
const SECTIONS = ['flight', 'spin', 'bounce', 'toss', 'swing', 'tolerance', 'returner', 'limits']

/** How the tool works, in plain words, with the one formula behind each part. */
export default function About({ onTool, toolHref }) {
  const { t, i18n } = useTranslation()
  const has = (key) => i18n.exists(key)
  return (
    <article className="about panel">
      <h1>{t('about.title')}</h1>
      <p className="about-intro">{t('about.intro')}</p>
      <p>
        <a className="donate" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
          {t('about.donate')}
        </a>
      </p>

      {SECTIONS.map((id) => (
        <section key={id} className="about-section">
          <h2>{t(`about.${id}.title`)}</h2>
          <p>
            <Trans i18nKey={`about.${id}.body`} components={{ b: <b /> }} />
          </p>
          {has(`about.${id}.formula`) && (
            <figure className="formula">
              <code>{t(`about.${id}.formula`)}</code>
              <figcaption>{t(`about.${id}.note`)}</figcaption>
            </figure>
          )}
        </section>
      ))}

      <p>
        <a
          href={toolHref}
          onClick={(e) => {
            e.preventDefault()
            onTool()
          }}
        >
          {t('about.back')}
        </a>
      </p>
    </article>
  )
}
