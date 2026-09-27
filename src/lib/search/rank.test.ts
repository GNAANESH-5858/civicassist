import { describe, expect, it } from 'vitest'
import { dot, rank, type SearchIndex } from './rank.ts'

const index: SearchIndex = {
  model: 'test',
  dim: 2,
  ids: [10, 20, 30],
  vectors: [
    [1, 0],
    [0, 1],
    [0.6, 0.8],
  ],
}

describe('dot', () => {
  it('computes the dot product', () => {
    expect(dot([1, 2], [3, 4])).toBe(11)
  })
  it('throws on mismatched lengths', () => {
    expect(() => dot([1], [1, 2])).toThrow('mismatch')
  })
})

describe('rank', () => {
  it('returns top k by score, highest first', () => {
    const r = rank([0, 1], index, 2)
    expect(r.map((x) => x.id)).toEqual([20, 30])
    expect(r[0].score).toBeCloseTo(1)
    expect(r[1].score).toBeCloseTo(0.8)
  })

  it('applies the allow filter before taking top k', () => {
    expect(rank([0, 1], index, 2, (id) => id !== 20).map((x) => x.id)).toEqual([30, 10])
  })
})
