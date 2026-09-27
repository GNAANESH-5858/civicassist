import { describe, expect, it } from 'vitest'
import { cosine, findDuplicate, tfidfVectors } from './duplicates.ts'

describe('tfidf + cosine', () => {
  it('scores identical docs 1 and disjoint docs 0', () => {
    const [a, b, c] = tfidfVectors([['water', 'suppli'], ['water', 'suppli'], ['garbag']])
    expect(cosine(a, b)).toBeCloseTo(1)
    expect(cosine(a, c)).toBe(0)
  })
  it('returns 0 for empty vectors', () => {
    expect(cosine(new Map(), new Map([['a', 1]]))).toBe(0)
  })
})

describe('findDuplicate', () => {
  const prior = [
    { id: 'C1', text: 'No water supply in our street for three days', ward: 'Ward 12' },
    { id: 'C2', text: 'Garbage not collected near the market', ward: 'Ward 40' },
  ]

  it('flags a near-identical complaint in the same ward', () => {
    const r = findDuplicate('No water supply in our street for 3 days!', 'Ward 12', prior)
    expect(r.duplicate_of).toBe('C1')
    expect(r.similarity).toBeGreaterThan(0.6)
  })

  it('does not flag the same text from a different ward', () => {
    const r = findDuplicate('No water supply in our street for three days', 'Ward 99', prior)
    expect(r.duplicate_of).toBeNull()
    expect(r.similarity).toBeGreaterThan(0.6)
  })

  it('does not flag an unrelated complaint', () => {
    expect(findDuplicate('Streetlight broken', 'Ward 12', prior).duplicate_of).toBeNull()
  })

  it('handles no prior complaints', () => {
    expect(findDuplicate('anything', 'Ward 1', [])).toEqual({ duplicate_of: null, similarity: 0 })
  })
})
