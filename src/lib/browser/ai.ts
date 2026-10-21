// Optional AI features through the server-side gateway. If the gateway reports that AI is not
// available, that is remembered for this visit so the app stops trying and shows the fallback.
import { parseExtraction, type Extraction } from '../llm/extract.ts'
import type { Gateway } from '../rag/ask.ts'

const OFF_KEY = 'civicassist.ai_off'

export function aiMarkedUnavailable(): boolean {
  try {
    return sessionStorage.getItem(OFF_KEY) === '1'
  } catch {
    return false
  }
}

export function markAiUnavailable(): void {
  try {
    sessionStorage.setItem(OFF_KEY, '1')
  } catch {
    // ignore
  }
}

/** Wraps a gateway call: on failure marks AI unavailable for this visit and rethrows. */
export function guarded(gateway: Gateway): Gateway {
  return async (action, payload) => {
    if (aiMarkedUnavailable()) throw new Error('AI unavailable')
    try {
      return await gateway(action, payload)
    } catch (e) {
      const msg = (e as Error).message
      if (/no API keys|providers failed|HTTP 5\d\d|HTTP 429|Failed to fetch|NetworkError/i.test(msg)) markAiUnavailable()
      throw e
    }
  }
}

export function makeExtractor(gateway: Gateway): (masked: string) => Promise<Extraction> {
  return async (masked) => {
    const r = await gateway('extract', { text: masked })
    const x = parseExtraction(r.text)
    if (!x) throw new Error('AI output did not match the expected format')
    return x
  }
}
