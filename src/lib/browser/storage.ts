// localStorage helpers. Every access is wrapped: storage can be missing or throw
// (private mode, blocked site data), and the app must still work without it.
import type { TriageResult } from '../nlp/triage.ts'

export interface KV {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function defaultStore(): KV | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string, fallback: T, store = defaultStore()): T {
  try {
    const raw = store?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown, store = defaultStore()): void {
  try {
    store?.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage blocked: silently skip, the app works without persistence.
  }
}

/** FNV-1a 53-bit hash, hex. Stable across sessions; used for cache keys. */
export function hashKey(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

// ---- Session complaint history (this browser only) ----

export const HISTORY_KEY = 'civicassist.complaints.v1'
export const RECENT_LIMIT = 20

export interface StoredComplaint {
  complaint_id: string
  created_at: string
  result: TriageResult
}

export function loadHistory(store = defaultStore()): StoredComplaint[] {
  const h = readJson<StoredComplaint[]>(HISTORY_KEY, [], store)
  return Array.isArray(h) ? h : []
}

export function saveComplaint(c: StoredComplaint, store = defaultStore()): StoredComplaint[] {
  const next = [...loadHistory(store), c].slice(-100)
  writeJson(HISTORY_KEY, next, store)
  return next
}

/** The last 20 complaints in the shape the triage function expects for repeat detection. */
export function recentForTriage(history: StoredComplaint[]): { id: string; text: string; ward: string | null }[] {
  return history.slice(-RECENT_LIMIT).map((c) => ({ id: c.complaint_id, text: c.result.masked_text, ward: c.result.ward }))
}
