// LLM client: Gemini first, Groq as fallback. Plain fetch, no SDKs.
// Keys are passed in by the caller (netlify/functions/llm.ts); this module never reads env.

export interface LLMRequest {
  system: string
  user: string
  temperature?: number
  topP?: number
  /** Ask the provider for a JSON object response. */
  json?: boolean
}

export interface LLMResponse {
  text: string
  provider: 'gemini' | 'groq'
  model: string
}

export interface LLMKeys {
  geminiKey?: string
  groqKey?: string
  geminiModel?: string
  groqModel?: string
}

export interface ClientDeps {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  timeoutMs?: number
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'
export const TIMEOUT_MS = 12_000
export const RETRY_DELAY_MS = 2_000

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const retryable = (e: unknown) => e instanceof HttpError && (e.status === 429 || e.status >= 500)

async function postJson(url: string, body: unknown, headers: Record<string, string>, deps: Required<ClientDeps>): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs)
  try {
    const res = await deps.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return await res.json()
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error(`timed out after ${deps.timeoutMs}ms`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

async function withOneRetry<T>(fn: () => Promise<T>, deps: Required<ClientDeps>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (!retryable(e)) throw e
    await deps.sleep(RETRY_DELAY_MS)
    return await fn()
  }
}

async function callGemini(req: LLMRequest, key: string, model: string, deps: Required<ClientDeps>): Promise<LLMResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const data = (await postJson(
    url,
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        topP: req.topP ?? 0.9,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
    },
    { 'x-goog-api-key': key },
    deps,
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error('Gemini returned no text')
  return { text, provider: 'gemini', model }
}

async function callGroq(req: LLMRequest, key: string, model: string, deps: Required<ClientDeps>): Promise<LLMResponse> {
  const data = (await postJson(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      temperature: req.temperature ?? 0.2,
      top_p: req.topP ?? 0.9,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
    },
    { Authorization: `Bearer ${key}` },
    deps,
  )) as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('Groq returned no text')
  return { text, provider: 'groq', model }
}

/** Gemini with a 12 s timeout and one retry after 2 s on 429/5xx; then Groq (same policy). */
export async function callLLM(req: LLMRequest, keys: LLMKeys, deps: ClientDeps = {}): Promise<LLMResponse> {
  const d: Required<ClientDeps> = {
    fetchImpl: deps.fetchImpl ?? fetch,
    sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    timeoutMs: deps.timeoutMs ?? TIMEOUT_MS,
  }
  const errors: string[] = []
  if (keys.geminiKey) {
    try {
      return await withOneRetry(() => callGemini(req, keys.geminiKey!, keys.geminiModel || DEFAULT_GEMINI_MODEL, d), d)
    } catch (e) {
      errors.push(`gemini: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (keys.groqKey) {
    try {
      return await withOneRetry(() => callGroq(req, keys.groqKey!, keys.groqModel || DEFAULT_GROQ_MODEL, d), d)
    } catch (e) {
      errors.push(`groq: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (!keys.geminiKey && !keys.groqKey) errors.push('no API keys configured (GEMINI_API_KEY / GROQ_API_KEY)')
  throw new Error(`All LLM providers failed: ${errors.join('; ')}`)
}
