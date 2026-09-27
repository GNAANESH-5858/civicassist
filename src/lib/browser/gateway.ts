// Browser client for /api/llm, with answers cached in localStorage by a hash of the request.
import type { Gateway, GatewayAction } from '../rag/ask.ts'
import { defaultStore, hashKey, readJson, writeJson, type KV } from './storage.ts'

export const CACHE_PREFIX = 'civicassist.llm.v1.'

export function cacheKey(action: GatewayAction, payload: Record<string, unknown>): string {
  return CACHE_PREFIX + hashKey(JSON.stringify({ action, payload }))
}

export function makeGateway(fetchImpl: typeof fetch = (...a) => fetch(...a), store: KV | null = defaultStore()): Gateway {
  return async (action, payload) => {
    const key = cacheKey(action, payload)
    const hit = readJson<{ text: string } | null>(key, null, store)
    if (hit?.text) return hit
    const res = await fetchImpl('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })
    let body: { text?: string; error?: string | null; provider?: string; model?: string }
    try {
      body = await res.json()
    } catch {
      throw new Error(`LLM gateway returned HTTP ${res.status}`)
    }
    if (!res.ok || body.error || !body.text) throw new Error(body.error || `LLM gateway returned HTTP ${res.status}`)
    const out = { text: body.text, provider: body.provider, model: body.model }
    writeJson(key, out, store)
    return out
  }
}
