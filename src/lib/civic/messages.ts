// Turns engine messages (key + ids) into text in the selected language. Ids are resolved to
// localised names from the knowledge base, so the engine itself stays language-independent.
import type { TFunction } from 'i18next'
import { authorityById, categoryById, channelById, pick, type Lang, type Localized } from './data.ts'
import type { Message } from './routing.ts'

export function categoryLabel(id: string, lang: Lang): string {
  const c = categoryById.get(id)
  return c ? pick(c.label, lang) : id
}

export function authorityLabel(id: string): string {
  return authorityById.get(id)?.name ?? id
}

export function channelLabel(id: string, lang: Lang): string {
  const c = channelById.get(id)
  return c ? pick(c.label, lang) : id
}

export function renderMessage(m: Message | { text: Localized }, lang: Lang, t: TFunction): string {
  if ('text' in m) return pick(m.text, lang)
  const p: Record<string, string | number> = { ...(m.params ?? {}) }
  for (const k of ['category', 'a', 'b']) if (typeof p[k] === 'string') p[k] = categoryLabel(p[k] as string, lang)
  if (typeof p.authority === 'string') p.authority = authorityLabel(p.authority)
  if (typeof p.channel === 'string' && p.channel) p.channel = channelLabel(p.channel, lang)
  if (typeof p.channels === 'string') p.channels = (p.channels as string).split(',').filter(Boolean).map((c) => channelLabel(c, lang)).join('; ')
  if (typeof p.missing === 'string') p.missing = (p.missing as string).split(',').filter(Boolean).map((q) => t(`guidance:question.${q}.short`)).join(', ')
  if (typeof p.evidence === 'string') p.evidence = (p.evidence as string).split(',').filter(Boolean).map((e) => t(`guidance:evidence.${e}`)).join(', ')
  return t(`guidance:${m.key}`, p)
}
