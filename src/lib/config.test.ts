import { describe, expect, it } from 'vitest'
import { EMBED_MODEL, NOT_FOUND_THRESHOLD, TOP_K } from './config'

describe('config', () => {
  it('uses the agreed retrieval settings', () => {
    expect(EMBED_MODEL).toBe('Xenova/all-MiniLM-L6-v2')
    expect(TOP_K).toBe(4)
    expect(NOT_FOUND_THRESHOLD).toBe(0.35)
  })

  it('keeps the threshold a valid cosine score', () => {
    expect(NOT_FOUND_THRESHOLD).toBeGreaterThan(0)
    expect(NOT_FOUND_THRESHOLD).toBeLessThan(1)
  })
})
