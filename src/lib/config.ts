// Shared retrieval settings. Used by the browser app and by the Node scripts.

/** Sentence-embedding model run in the browser via @huggingface/transformers. */
export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2'

/** Number of knowledge-base records passed to the answer step. */
export const TOP_K = 4

/** If the best cosine score is below this, reply "not in my documents" without calling a model. */
export const NOT_FOUND_THRESHOLD = 0.35
