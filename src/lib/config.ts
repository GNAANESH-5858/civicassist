// Shared retrieval settings. Used by the browser app and by the Node scripts.

/** Sentence-embedding model run in the browser via @huggingface/transformers. */
export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2'

/** Number of knowledge-base records passed to the answer step. */
export const TOP_K = 4

/** If the best cosine score is below this, reply "not in my documents" without calling a model. */
export const NOT_FOUND_THRESHOLD = 0.35

/**
 * Bonus added to the cosine score from the record's applicability, so a Chennai-specific record
 * outranks a national one of equal semantic similarity. Applied to every complaint (the service
 * covers Greater Chennai Corporation only). The first matching rule applies.
 * Ranking uses the boosted score; the not-found gate ALWAYS uses the raw cosine score, so a
 * boost can never push a weakly matched record past the relevance gate.
 */
export const LOCALITY_BOOST = {
  chennai: 0.08,
  tamilNadu: 0.05,
  urban: 0.03, // "Urban" or "ULB"
  other: 0, // National, Selected areas, etc.
} as const

/**
 * Official channels where the citizen files the letter THEMSELVES. CivicAssist never submits,
 * emails or calls any external service on the citizen's behalf: the complaints in this project
 * are synthetic, and filing them would put fabricated reports in front of real staff.
 * Verified September 2026. Re-check every entry before any real use.
 */
export const SUBMISSION_CHANNELS: { label: string; url?: string; note?: string }[] = [
  { label: 'GCC Public Grievance Redressal', url: 'https://gccservices.in/pgr' },
  { label: 'Register a complaint (GCC ERP portal)', url: 'https://erp.chennaicorporation.gov.in/pgr/citizen/BeforeReg.do' },
  { label: 'Namma Chennai app', note: 'Search for "Namma Chennai" on the Play Store or App Store' },
  { label: 'Helpline', note: 'Call 1913' },
]
