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
