import { describe, expect, it, vi } from 'vitest'
import { callLLM } from './client.ts'

const gemini = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))
const groq = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }))
const status = (s: number) => new Response('err', { status: s })
const noSleep = vi.fn(async () => {})
const req = { system: 's', user: 'u' }

describe('callLLM', () => {
  it('uses Gemini when it succeeds', async () => {
    const f = vi.fn(async () => gemini('hi'))
    const r = await callLLM(req, { geminiKey: 'g', groqKey: 'q' }, { fetchImpl: f as never, sleep: noSleep })
    expect(r).toEqual({ text: 'hi', provider: 'gemini', model: 'gemini-2.5-flash' })
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('generativelanguage.googleapis.com')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('g')
  })

  it('retries Gemini once after 2s on 429, then succeeds', async () => {
    const f = vi.fn().mockResolvedValueOnce(status(429)).mockResolvedValueOnce(gemini('ok'))
    const sleep = vi.fn(async () => {})
    const r = await callLLM(req, { geminiKey: 'g' }, { fetchImpl: f, sleep })
    expect(r.text).toBe('ok')
    expect(sleep).toHaveBeenCalledWith(2000)
  })

  it('falls back to Groq after Gemini fails twice with 5xx', async () => {
    const f = vi.fn().mockResolvedValueOnce(status(503)).mockResolvedValueOnce(status(500)).mockResolvedValueOnce(groq('from groq'))
    const r = await callLLM(req, { geminiKey: 'g', groqKey: 'q' }, { fetchImpl: f, sleep: noSleep })
    expect(r.provider).toBe('groq')
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 400; goes straight to Groq', async () => {
    const f = vi.fn().mockResolvedValueOnce(status(400)).mockResolvedValueOnce(groq('g2'))
    const r = await callLLM(req, { geminiKey: 'g', groqKey: 'q' }, { fetchImpl: f, sleep: noSleep })
    expect(r.text).toBe('g2')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('times out a hung request', async () => {
    const hang = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))))
    await expect(callLLM(req, { geminiKey: 'g' }, { fetchImpl: hang as never, sleep: noSleep, timeoutMs: 10 })).rejects.toThrow(/timed out/)
  })

  it('reports missing keys clearly', async () => {
    await expect(callLLM(req, {})).rejects.toThrow(/no API keys configured/)
  })
})
