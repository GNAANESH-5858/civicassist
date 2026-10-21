// Combines the deterministic frame with the optional AI extraction. The AI result can only
// (a) suggest a category when the rules were unsure and (b) fill in missing location/landmark/
// duration. It never overrides what the citizen explicitly chose, and every AI-filled field is
// marked so the UI can say so. Without AI, the rules-only frame is returned unchanged.
import type { Extraction } from '../llm/extract.ts'
import { buildFrame, type ComplaintFrame, type FrameOptions } from './frame.ts'
import { LOCALITIES } from './lexicon.ts'

export interface AssistedFrame extends ComplaintFrame {
  ai_used: boolean
  ai_fields: string[]
  /** English one-line summary from AI, used for scheme search; null without AI. */
  english_summary: string | null
  ai_error: string | null
}

export type Extractor = (maskedText: string) => Promise<Extraction>

export function mergeExtraction(frame: ComplaintFrame, x: Extraction): AssistedFrame {
  const fields: string[] = []
  const out: AssistedFrame = { ...frame, ai_used: true, ai_fields: fields, english_summary: x.english_summary, ai_error: null }
  if (frame.category_source !== 'user' && frame.confidence === 'low') {
    out.category = x.category
    out.confidence = 'medium'
    out.category_source = 'ai'
    out.candidates = [{ id: x.category, score: 1, matched: [] }, ...(x.alternative_category ? [{ id: x.alternative_category, score: 0.5, matched: [] }] : []), ...frame.candidates.filter((c) => c.id !== x.category && c.id !== x.alternative_category)].slice(0, 3)
    fields.push('category')
  }
  if (!frame.locality && x.locality) {
    const known = LOCALITIES.find((l) => l.name.toLowerCase() === x.locality!.toLowerCase())
    out.locality = known ?? { name: x.locality, forms: [] }
    fields.push('locality')
  }
  if (!frame.landmark && x.landmark) {
    out.landmark = x.landmark
    fields.push('landmark')
  }
  if (!frame.duration && x.duration_days !== null && x.duration_days > 0) {
    out.duration = x.duration_days >= 7 && x.duration_days % 7 === 0 ? { value: x.duration_days / 7, unit: 'week' } : { value: Math.round(x.duration_days), unit: 'day' }
    fields.push('duration')
  }
  if (frame.premises === null && x.premises) {
    out.premises = x.premises
    fields.push('premises')
  }
  return out
}

/** Builds a frame, then improves it with AI extraction when an extractor is available and works. */
export async function assistFrame(text: string, opts: FrameOptions, extractor: Extractor | null): Promise<AssistedFrame> {
  const frame = buildFrame(text, opts)
  const base: AssistedFrame = { ...frame, ai_used: false, ai_fields: [], english_summary: null, ai_error: null }
  if (!extractor) return base
  try {
    return mergeExtraction(frame, await extractor(frame.text))
  } catch (e) {
    return { ...base, ai_error: (e as Error).message }
  }
}
