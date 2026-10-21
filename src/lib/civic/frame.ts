// Language-independent complaint frame. The same frame drives routing, questions, the action plan
// and the letter in every language, so English, Tamil and Hindi complaints are handled identically.
import { maskPII } from '../nlp/pii.ts'
import { CATEGORIES, categoryById, type Category, type Lang } from './data.ts'
import { detectLanguage, normalizeText } from './language.ts'
import { findDuration, findLandmark, findLocality, findReference, findWard, mentionsPrivate, mentionsPublic, type Duration, type Locality } from './lexicon.ts'
import { detectHazards, safetyLevel, type Hazard } from './safety.ts'

export type Confidence = 'high' | 'medium' | 'low'

export interface CategoryScore {
  id: string
  score: number
  matched: string[]
}

export interface ComplaintFrame {
  /** Masked text only. Personal details never enter the frame. */
  text: string
  language: Lang | null
  mixed_language: boolean
  category: string
  confidence: Confidence
  /** Ranked alternatives (top 3) for transparency and clarification. */
  candidates: CategoryScore[]
  locality: Locality | null
  ward: number | null
  landmark: string | null
  duration: Duration | null
  previous_reference: string | null
  /** 'public' | 'private' | null when the text does not say. */
  premises: 'public' | 'private' | null
  hazards: Hazard[]
  safety: 'emergency' | 'urgent' | 'none'
  /** Who supplied the category: deterministic rules, the English classifier, or the optional AI extraction. */
  category_source: 'rules' | 'classifier' | 'ai' | 'user'
  pii_masked: boolean
}

const LATIN_LETTER = /[a-z]/
const WORD_CHAR = /[a-z0-9஀-௿ऀ-ॿ]/

/**
 * True when keyword k occurs in t at a word start. Latin keywords must also end at a word
 * boundary (a plural "s" is allowed): "park" must not match "parking". Tamil and Hindi keywords
 * may be followed by suffixes (agglutination) but must start a word: "नल" (tap) must not match
 * inside "सिग्नल" (signal).
 */
export function matchesAt(t: string, k: string): boolean {
  let from = 0
  for (;;) {
    const at = t.indexOf(k, from)
    if (at === -1) return false
    from = at + 1
    const before = t[at - 1]
    if (before && WORD_CHAR.test(before)) continue
    if (LATIN_LETTER.test(k[k.length - 1])) {
      const after = t[at + k.length]
      if (after && LATIN_LETTER.test(after) && !(after === 's' && !LATIN_LETTER.test(t[at + k.length + 1] ?? ''))) continue
    }
    return true
  }
}

/** Scores every category by keyword matches across English, Tamil and Hindi. Longer phrases weigh more. */
export function scoreCategories(text: string): CategoryScore[] {
  const t = normalizeText(text)
  const scores: CategoryScore[] = []
  for (const c of CATEGORIES) {
    let score = 0
    const matched: string[] = []
    for (const lang of ['en', 'ta', 'hi'] as const) {
      for (const kw of c.keywords[lang]) {
        const k = normalizeText(kw)
        if (!k) continue
        if (!matchesAt(t, k)) continue
        score += k.includes(' ') ? 2 : 1
        matched.push(kw)
      }
    }
    if (score) scores.push({ id: c.id, score, matched })
  }
  return scores.sort((a, b) => b.score - a.score)
}

// Disambiguation between categories that share vocabulary.
function resolve(scores: CategoryScore[], t: string): CategoryScore[] {
  const has = (id: string) => scores.find((s) => s.id === id)
  const bump = (id: string, by: number) => {
    const s = has(id)
    if (s) s.score += by
  }
  // A street light is not an electricity-board matter unless power itself is out.
  if (has('streetlight') && has('electricity') && !/power cut|no power|power failure|மின்வெட்டு|மின் தடை|बिजली कटौती|बिजली नहीं/.test(t)) bump('streetlight', 3)
  // Sewage words beat generic drain/flood words.
  if (has('sewage') && has('drainage_flooding')) bump('sewage', 1)
  // Burning garbage is pollution first (smoke) but mention of garbage alone is SWM.
  if (has('pollution') && has('garbage') && /burn|எரி|जला/.test(t)) bump('pollution', 2)
  // "pothole" style road words beat "water" in "pothole filled with water".
  if (has('roads') && has('water_supply') && !/no water|supply|குடிநீர்|पानी नहीं|आपूर्ति/.test(t)) bump('roads', 2)
  // Something built or placed on a footpath is an encroachment, not road damage.
  if (has('building') && has('roads')) bump('building', 2)
  // A power cut with a noisy transformer is an electricity complaint, not a noise complaint.
  if (has('electricity') && has('noise') && /power cut|no power|power failure|transformer|மின்வெட்டு|மின்மாற்றி|बिजली|ट्रांसफार्मर/.test(t)) bump('electricity', 2)
  // "No current / लाइट नहीं / கரண்ட் இல்லை" in a home means the power supply, not a street light.
  if (has('electricity') && has('streetlight') && /no current|power (is )?off|current cut|लाइट नहीं|लाइट गई|बिजली गई|கரண்ட் இல்லை|மின்சாரம் இல்லை/.test(t)) bump('electricity', 4)
  return scores.sort((a, b) => b.score - a.score)
}

/** Category labels from the existing English Naive Bayes triage, mapped to civic categories. */
export function categoriesForDepartment(department: string | null | undefined): string[] {
  if (!department) return []
  return CATEGORIES.filter((c) => c.triage_departments.includes(department)).map((c) => c.id)
}

export interface FrameOptions {
  /** Department predicted by the existing triage (English classifier), used as a weak signal. */
  triageDepartment?: string | null
  /** Category chosen explicitly by the user (quick-start button or correction). Wins over everything. */
  userCategory?: string | null
}

export function buildFrame(rawText: string, opts: FrameOptions = {}): ComplaintFrame {
  const { text, counts } = maskPII(rawText.slice(0, 4000))
  const t = normalizeText(text)
  const lang = detectLanguage(text)
  let scores = resolve(scoreCategories(text), t)
  let source: ComplaintFrame['category_source'] = 'rules'

  // The English classifier (trained on synthetic GCC complaints) is a weak signal: it decides only
  // when no keyword matched, and then never with high confidence. One department label can cover
  // two categories (e.g. water supply and sewage); both are offered so the citizen can choose.
  const fromTriage = lang.lang === 'en' ? categoriesForDepartment(opts.triageDepartment) : []
  let classifierOnly = false
  if (!scores.length && fromTriage.length) {
    scores = fromTriage.map((id) => ({ id, score: 1, matched: [] }))
    source = 'classifier'
    classifierOnly = true
  } else if (fromTriage.length) {
    for (const s of scores) if (fromTriage.includes(s.id)) s.score += 0.5
    scores.sort((a, b) => b.score - a.score)
  }

  let category = scores[0]?.id ?? 'other'
  let confidence: Confidence = 'low'
  if (scores.length) {
    const margin = scores[0].score - (scores[1]?.score ?? 0)
    // One single-word keyword is weak evidence (it may be a place name, "Lake View Road", or
    // incidental, "near the park"): ask the citizen to confirm rather than route silently.
    const singleWeakWord = scores[0].matched.length === 1 && !scores[0].matched[0].includes(' ') && scores[0].score < 2
    confidence = scores[0].score >= 2 && margin >= 1 ? 'high' : scores[0].score >= 1 && margin > 0 && !singleWeakWord ? 'medium' : 'low'
    // Classifier-only guesses are offered pre-selected but always confirmed by the citizen.
    if (classifierOnly) confidence = 'low'
  }
  if (opts.userCategory && categoryById.has(opts.userCategory)) {
    category = opts.userCategory
    confidence = 'high'
    source = 'user'
  }

  const hazards = detectHazards(text)
  const premises = mentionsPrivate(text) ? 'private' : mentionsPublic(text) ? 'public' : null
  return {
    text,
    language: lang.lang,
    mixed_language: lang.mixed,
    category,
    confidence,
    candidates: scores.slice(0, 3),
    locality: findLocality(text),
    ward: findWard(text),
    landmark: findLandmark(text),
    duration: findDuration(text),
    previous_reference: findReference(text),
    premises,
    hazards,
    safety: safetyLevel(hazards),
    category_source: source,
    pii_masked: counts.phone + counts.id_number + counts.email > 0,
  }
}

export function categoryOf(frame: ComplaintFrame): Category {
  return categoryById.get(frame.category) ?? categoryById.get('other')!
}
