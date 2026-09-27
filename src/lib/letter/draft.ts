// Complaint letter drafting: two gateway calls (draft, then critique-and-rewrite).
// The letter is FROM the citizen TO the municipal office. The address block and the closing
// with bracketed placeholders are enforced in code after every draft, so the sender can never
// become the Corporation. Falls back to a deterministic template when the LLM is unavailable.
import { ELIGIBILITY_PHRASE } from '../prompts/answer.ts'
import type { ContextRecord } from '../prompts/context.ts'
import { addressBlock, CLOSING, formatLetterDate, LETTER_MAX_WORDS, LETTER_PROMPT_VERSION, PLACEHOLDERS, type LetterInput } from '../prompts/letter.v2.ts'
import { detectInjection } from '../nlp/injection.ts'
import type { Gateway } from '../rag/ask.ts'

export { CLOSING } from '../prompts/letter.v2.ts'

export interface LetterDraft {
  text: string
  prompt_version: string
  source: 'llm' | 'template'
  stages: ('draft' | 'critique')[]
  warnings: string[]
  error: string | null
}

export const TEMPLATE_VERSION = 'template.v2'

export function citeRecord(r: Pick<ContextRecord, 'id' | 'page'>): string {
  return `Scheme #${r.id}, knowledge base page ${r.page}`
}

/** ONE sentence citing retrieved records as supporting grounds, phrased as a request. */
export function groundsSentence(records: ContextRecord[]): string | null {
  const schemes = records.filter((r) => r.kind === 'scheme').slice(0, 2)
  const rules = records.filter((r) => r.kind === 'regulatory').slice(0, 1)
  if (schemes.length) {
    const named = schemes.map((r) => `the ${r.name} (${citeRecord(r)})`).join(' or ')
    return `I understand that works of this nature may fall within the scope of ${named}, and request that the matter be considered accordingly, ${ELIGIBILITY_PHRASE.replace('may be applicable, ', '')}.`
  }
  if (rules.length) {
    const r = rules[0]
    return `I understand that this matter may be governed by the ${r.name} (${citeRecord(r)}), and request that it be dealt with in accordance with the applicable rules.`
  }
  return null
}

/** Deterministic citizen-to-Corporation letter that satisfies R2-R4 by construction. */
export function templateLetter(i: LetterInput): string {
  const place = i.ward ? `${i.ward}, Chennai` : 'my area, Chennai'
  const issue = i.issue ?? 'a civic problem'
  const lines = [
    addressBlock(i),
    '',
    `Date: ${i.date ?? formatLetterDate(new Date())}`,
    `Subject: Complaint regarding ${issue} in ${place}`,
    `Reference: Complaint ID ${i.complaint_id}`,
    '',
    'Sir/Madam,',
    '',
    // Quote the citizen's own words, unless they contain instructions aimed at the system:
    // then describe the issue only, so injected text can never appear in the letter.
    detectInjection(i.complaint)
      ? `I respectfully wish to bring to your notice a problem concerning ${issue} in ${place}. This is causing inconvenience to residents of the area.`
      : `I respectfully wish to bring to your notice the following problem in ${place}: "${i.complaint.replace(/\s*\[(PHONE|ID|EMAIL)\]\s*/g, ' ').trim()}" ` +
        'This is causing inconvenience to residents of the area.',
    '',
    `I request that the ${i.department ?? 'concerned'} department inspect the site and take the necessary action at the earliest${i.urgency === 'high' ? ', as the matter affects the health and safety of residents' : ''}.`,
  ]
  const grounds = groundsSentence(i.records)
  if (grounds) lines.push('', grounds)
  lines.push('', 'Thank you for your attention to this matter.', '', CLOSING)
  return lines.join('\n')
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Makes the letter structurally safe whatever the model wrote: the exact address block at the
 * top, and the exact closing with bracketed placeholders at the end (replacing any sign-off the
 * model produced, such as an official one).
 */
export function enforceStructure(text: string, i: LetterInput): string {
  let t = text.replace(/\r\n/g, '\n').trim()
  // Cut from the first sign-off onwards and append the citizen's closing.
  const signOff = /\n\s*(yours\s+(faithfully|sincerely|truly)|regards|thanking you)\b[\s\S]*$/i
  t = t.replace(signOff, '').trimEnd()
  // Replace whatever address block the model wrote with the fixed one.
  const block = addressBlock(i)
  if (!t.startsWith(block)) {
    const dateAt = t.search(/^\s*Date\s*:/im)
    t = dateAt >= 0 ? `${block}\n\n${t.slice(dateAt).trimStart()}` : `${block}\n\n${t}`
  }
  // Salutation on its own paragraph.
  t = t.replace(/([^\n])\n((?:Respected )?Sir\/Madam,)/, '$1\n\n$2')
  return `${t}\n\n${CLOSING}`
}

const OFFICIAL_VOICE = /grievance cell|yours faithfully,?\s*\n?\s*(the\s+)?(greater chennai corporation|commissioner|executive engineer|corporation|department)|on behalf of (the )?(greater chennai )?corporation|we have (registered|received) your complaint|dear citizen/i

/** Post-checks a letter against the rules; returns human-readable warnings (empty = clean). */
export function lintLetter(text: string, records: ContextRecord[]): string[] {
  const w: string[] = []
  if (wordCount(text) > LETTER_MAX_WORDS) w.push(`Letter is ${wordCount(text)} words (limit ${LETTER_MAX_WORDS}).`)
  if (!/^\s*To,/m.test(text)) w.push('Missing the "To," address block.')
  if (OFFICIAL_VOICE.test(text)) w.push('Reads as if written by the Corporation or an official; the sender must be the citizen.')
  for (const p of PLACEHOLDERS) if (!text.includes(p)) w.push(`Placeholder ${p} is missing from the closing.`)
  const ids = new Set(records.map((r) => r.id))
  for (const m of text.matchAll(/Scheme #(\d+)/g)) if (!ids.has(Number(m[1]))) w.push(`Mentions Scheme #${m[1]}, which was not retrieved.`)
  if (/\b(i am|you are|we are)\s+(eligible|entitled)\b|\bentitled to\b|\beligible for\b|\bqualif(y|ies) for\b|\bwill receive\b/i.test(text)) w.push('Claims eligibility or entitlement (R3).')
  for (const r of records.filter((x) => x.kind === 'regulatory')) {
    const re = new RegExp(`#${r.id}[^.]{0,120}\\b(benefit|entitle\\w*|subsid\\w*)\\b`, 'i')
    if (re.test(text)) w.push(`Describes regulatory Scheme #${r.id} as a benefit (R2).`)
  }
  if (/https?:\/\//.test(text)) w.push('Contains a URL in the body; sources are listed at the foot automatically.')
  if (/\[(PHONE|ID|EMAIL)\]/.test(text)) w.push('Contains a masked token such as [PHONE]; remove it before submitting.')
  return w
}

export async function draftLetter(input: LetterInput, llm: Gateway): Promise<LetterDraft> {
  const i = { ...input, date: input.date ?? formatLetterDate(new Date()) }
  let draft: string
  try {
    draft = (await llm('letter', { ...i, stage: 'draft' })).text.trim()
    if (!draft) throw new Error('empty draft')
  } catch (e) {
    const text = templateLetter(i)
    return { text, prompt_version: TEMPLATE_VERSION, source: 'template', stages: [], warnings: lintLetter(text, i.records), error: `LLM unavailable, used template: ${(e as Error).message}` }
  }
  try {
    const revised = (await llm('letter', { ...i, stage: 'critique', draft })).text.trim()
    const text = enforceStructure(revised || draft, i)
    return { text, prompt_version: LETTER_PROMPT_VERSION, source: 'llm', stages: ['draft', 'critique'], warnings: lintLetter(text, i.records), error: null }
  } catch (e) {
    const text = enforceStructure(draft, i)
    return {
      text,
      prompt_version: LETTER_PROMPT_VERSION,
      source: 'llm',
      stages: ['draft'],
      warnings: ['Critique step failed; this draft was not self-reviewed.', ...lintLetter(text, i.records)],
      error: (e as Error).message,
    }
  }
}
