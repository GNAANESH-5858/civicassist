// Letter drafting: two gateway calls (draft, then critique-and-rewrite).
// Falls back to a deterministic template built only from the triage result and records.
import { ELIGIBILITY_PHRASE } from '../prompts/answer.ts'
import type { ContextRecord } from '../prompts/context.ts'
import { LETTER_MAX_WORDS, LETTER_PROMPT_VERSION, type LetterInput } from '../prompts/letter.v1.ts'
import type { Gateway } from '../rag/ask.ts'

export interface LetterDraft {
  text: string
  prompt_version: string
  source: 'llm' | 'template'
  stages: ('draft' | 'critique')[]
  warnings: string[]
  error: string | null
}

export const TEMPLATE_VERSION = 'template.v1'
export const CLOSING = 'Yours faithfully,\nGrievance Cell, Greater Chennai Corporation'

export function citeRecord(r: ContextRecord): string {
  return `Scheme #${r.id}, ${r.name}, page ${r.page}`
}

/** Deterministic letter that satisfies R2-R4 by construction. Used when the LLM is unavailable. */
export function templateLetter(i: LetterInput): string {
  const lines: string[] = ['Dear Citizen,', '']
  const where = i.ward ? ` in ${i.ward}` : ''
  lines.push(
    `Thank you for your complaint (ID ${i.complaint_id}) regarding ${i.issue ?? 'the issue you reported'}${where}. ` +
      `It has been registered and forwarded to the ${i.department ?? 'concerned'} department${i.urgency === 'high' ? ', where it has been marked as high priority' : ''}. ` +
      'An officer will review it and arrange the necessary inspection and action.',
  )
  const schemes = i.records.filter((r) => r.kind === 'scheme')
  const rules = i.records.filter((r) => r.kind === 'regulatory')
  if (rules.length) {
    lines.push('', `The applicable rule for this matter is ${rules.map((r) => `(${citeRecord(r)})`).join(' and ')}.`)
  }
  if (schemes.length) {
    lines.push(
      '',
      `The following programme${schemes.length > 1 ? 's' : ''} ${schemes.length > 1 ? 'are' : 'is'} noted for reference: ` +
        `${schemes.map((r) => `(${citeRecord(r)})`).join('; ')}. ` +
        `${schemes.length > 1 ? 'These' : 'This'} ${ELIGIBILITY_PHRASE}. Please verify details at the official source listed below.`,
    )
  }
  lines.push('', CLOSING)
  return lines.join('\n')
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** Post-checks a letter against the rules; returns human-readable warnings (empty = clean). */
export function lintLetter(text: string, records: ContextRecord[]): string[] {
  const w: string[] = []
  const body = text.replace(CLOSING, '')
  if (wordCount(body) > LETTER_MAX_WORDS) w.push(`Body is ${wordCount(body)} words (limit ${LETTER_MAX_WORDS}).`)
  const ids = new Set(records.map((r) => r.id))
  for (const m of text.matchAll(/Scheme #(\d+)/g)) if (!ids.has(Number(m[1]))) w.push(`Mentions Scheme #${m[1]}, which was not retrieved.`)
  if (/\byou are (eligible|entitled)\b|\bqualif(y|ies) for\b|\bwill receive\b/i.test(text)) w.push('Asserts eligibility or a guaranteed benefit (R3).')
  for (const r of records.filter((x) => x.kind === 'regulatory')) {
    const re = new RegExp(`#${r.id}[^.]{0,120}\\b(benefit|entitle\\w*|subsid\\w*|claim)\\b`, 'i')
    if (re.test(text)) w.push(`Describes regulatory Scheme #${r.id} as a benefit (R2).`)
  }
  if (/https?:\/\//.test(body)) w.push('Contains a URL in the body; sources are listed at the foot automatically.')
  return w
}

export async function draftLetter(input: LetterInput, llm: Gateway): Promise<LetterDraft> {
  const payload = { ...input }
  let draft: string
  try {
    draft = (await llm('letter', { ...payload, stage: 'draft' })).text.trim()
    if (!draft) throw new Error('empty draft')
  } catch (e) {
    const text = templateLetter(input)
    return { text, prompt_version: TEMPLATE_VERSION, source: 'template', stages: [], warnings: lintLetter(text, input.records), error: `LLM unavailable, used template: ${(e as Error).message}` }
  }
  try {
    const revised = (await llm('letter', { ...payload, stage: 'critique', draft })).text.trim()
    const text = revised || draft
    return { text, prompt_version: LETTER_PROMPT_VERSION, source: 'llm', stages: ['draft', 'critique'], warnings: lintLetter(text, input.records), error: null }
  } catch (e) {
    return {
      text: draft,
      prompt_version: LETTER_PROMPT_VERSION,
      source: 'llm',
      stages: ['draft'],
      warnings: ['Critique step failed; this draft was not self-reviewed.', ...lintLetter(draft, input.records)],
      error: (e as Error).message,
    }
  }
}
