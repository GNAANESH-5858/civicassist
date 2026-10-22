import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { questionDef, type QuestionId } from '../../lib/civic/questions.ts'
import { CATEGORIES, pick } from '../../lib/civic/data.ts'
import { currentLang } from '../../i18n.ts'

/** One follow-up question: free text, choice or yes/no. Every question can be skipped. */
export function QuestionField({ id, onAnswer, onSkip }: { id: QuestionId; onAnswer: (value: string) => void; onSkip: () => void }) {
  const { t } = useTranslation()
  const def = questionDef(id)
  const [text, setText] = useState('')
  const options = def.kind === 'yesno' ? ['yes', 'no', 'unknown'] : (def.options ?? [])
  return (
    <fieldset className="card flat" style={{ border: '1px solid var(--border)' }}>
      <legend className="field-label" style={{ padding: '0 4px' }}>
        {t(`guidance:question.${id}.label`)}
      </legend>
      {def.kind === 'text' ? (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) onAnswer(text.trim())
          }}
        >
          <label htmlFor={`q-${id}`} className="sr-only">
            {t(`guidance:question.${id}.label`)}
          </label>
          <input id={`q-${id}`} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t(`guidance:question.${id}.placeholder`)} maxLength={200} />
          <button type="submit" disabled={!text.trim()}>
            {t('common.save')}
          </button>
        </form>
      ) : (
        <div className="choice-row">
          {options.map((o) => (
            <button key={o} type="button" className="chip" onClick={() => onAnswer(o)}>
              {def.kind === 'yesno' ? t(`guidance:yesno.${o}`) : t(`guidance:question.${id}.option.${o}`)}
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <button type="button" className="btn-ghost" onClick={onSkip}>
          {t('common.skip')}
        </button>
      </div>
    </fieldset>
  )
}

/** Category chooser: suggested candidates first, then every category. */
export function CategoryPicker({ candidates, selected, onPick }: { candidates: string[]; selected?: string | null; onPick: (id: string) => void }) {
  const lang = currentLang()
  const order = [...new Set([...candidates, ...CATEGORIES.map((c) => c.id)])]
  return (
    <div className="chips" role="group">
      {order.map((id) => {
        const c = CATEGORIES.find((x) => x.id === id)!
        return (
          <button key={id} type="button" aria-pressed={selected === id} onClick={() => onPick(id)} className={candidates.includes(id) ? 'chip suggested' : 'chip'}>
            {pick(c.label, lang)}
          </button>
        )
      })}
    </div>
  )
}
