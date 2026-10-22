// Shared building blocks for the CivicAssist interface: motion wrappers, the complaint input,
// the progress stepper and the detail drawer. Pages compose these instead of styling ad hoc.
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconArrow, IconCheck, IconClose } from './icons.tsx'

export const EASE = [0.2, 0.7, 0.2, 1] as const

/** Fades content up once when it scrolls into view. Content is always rendered (no scroll gating for access). */
export function Reveal({ children, delay = 0, className, as = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' }) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  if (reduce) return <Tag className={className}>{children}</Tag>
  return (
    <Tag className={className} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -60px 0px' }} transition={{ duration: 0.5, delay, ease: EASE }}>
      {children}
    </Tag>
  )
}

/** Staggers its direct motion children (use with <StaggerItem>). */
export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const Tag = motion[as]
  return (
    <Tag className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -40px 0px' }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
      {children}
    </Tag>
  )
}

export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const Tag = motion[as]
  return (
    <Tag className={className} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
      {children}
    </Tag>
  )
}

export function GradientText({ children }: { children: ReactNode }) {
  return <span className="gradient-text">{children}</span>
}

export function SectionHeading({ eyebrow, title, children, action }: { eyebrow?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  )
}

/** Textarea that grows with its content up to the CSS max-height. */
export function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [props.value])
  return <textarea ref={ref} rows={2} {...props} />
}

export const MIN_DESCRIPTION = 5

/**
 * The large complaint input used on the home and report pages. Enter submits (Shift+Enter adds a line),
 * and the text is never cleared on submit, so nothing is lost if the next step fails.
 */
export function ComplaintInput({
  id,
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  hint,
  submitLabel,
  busy = false,
  error,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  label: string
  placeholder: string
  hint?: string
  submitLabel: string
  busy?: boolean
  error?: string | null
}) {
  const { t } = useTranslation()
  const hintId = useId()
  const errId = useId()
  const tooShort = value.trim().length > 0 && value.trim().length < MIN_DESCRIPTION
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim().length >= MIN_DESCRIPTION && !busy) onSubmit()
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="complaint-input">
        <div className="complaint-input-inner">
          <AutoTextarea
            id={id}
            value={value}
            maxLength={2000}
            placeholder={placeholder}
            aria-describedby={`${hint ? hintId : ''} ${error || tooShort ? errId : ''}`.trim() || undefined}
            aria-invalid={Boolean(error) || undefined}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                if (value.trim().length >= MIN_DESCRIPTION && !busy) onSubmit()
              }
            }}
          />
          <div className="complaint-input-bar">
            {hint && (
              <p className="hint" id={hintId}>
                {hint}
              </p>
            )}
            <button type="submit" disabled={busy || value.trim().length < MIN_DESCRIPTION}>
              {busy ? <span className="spinner" aria-hidden /> : null}
              {submitLabel} {!busy && <IconArrow className="arrow" />}
            </button>
          </div>
        </div>
      </div>
      {(error || tooShort) && (
        <p className="field-error" id={errId} role={error ? 'alert' : undefined}>
          {error ?? t('home.input_too_short')}
        </p>
      )}
    </form>
  )
}

/** Step list with an animated progress bar. Steps before the current one show a check. */
export function ProgressStepper<S extends string>({ steps, current, label, labelOf, enabled, onSelect }: { steps: readonly S[]; current: S; label: string; labelOf: (s: S) => string; enabled: (s: S) => boolean; onSelect: (s: S) => void }) {
  const index = steps.indexOf(current)
  return (
    <nav aria-label={label}>
      <ol className="stepper">
        {steps.map((s, i) => (
          <li key={s} className={`${s === current ? 'current' : ''} ${index > i ? 'done' : ''}`}>
            <button type="button" disabled={!enabled(s)} aria-current={s === current ? 'step' : undefined} onClick={() => onSelect(s)}>
              <span className="num">{index > i ? <IconCheck size={12} /> : i + 1}</span>
              <span className="label">{labelOf(s)}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="progress" aria-hidden>
        <motion.div initial={false} animate={{ scaleX: (index + 1) / steps.length }} transition={{ duration: 0.45, ease: EASE }} />
      </div>
    </nav>
  )
}

/** Side panel dialog. Escape and the backdrop close it; focus moves into it and back when it closes. */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open, onClose])
  // Entrance is a CSS animation and closing unmounts at once, so a closed drawer can never linger
  // over the page waiting for an exit animation.
  if (!open) return null
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div ref={panel} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <IconClose />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  )
}

/** Subtle indicator for real asynchronous work (never used to fake typing of a ready answer). */
export function TypingIndicator({ label }: { label: string }) {
  return (
    <span className="typing" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  )
}
