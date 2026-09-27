import { describe, expect, it } from 'vitest'
import { duplicateScores, f1, mean, precisionAtK, recallAtK, reciprocalRank } from './metrics.ts'

describe('retrieval metrics', () => {
  it('precision@4 counts relevant items in the top 4', () => {
    expect(precisionAtK([1, 2, 3, 4, 5], [2, 4, 5])).toBe(0.5)
    expect(precisionAtK([], [1])).toBe(0)
  })
  it('recall@4 is the share of relevant items in the top 4', () => {
    expect(recallAtK([1, 2, 3, 4, 5], [2, 5])).toBe(0.5)
    expect(recallAtK([1], [])).toBe(0)
  })
  it('reciprocal rank uses the first relevant hit', () => {
    expect(reciprocalRank([9, 8, 2], [2, 8])).toBe(0.5)
    expect(reciprocalRank([9], [2])).toBe(0)
  })
  it('mean of empty is 0', () => {
    expect(mean([])).toBe(0)
    expect(mean([1, 0])).toBe(0.5)
  })
})

describe('f1 and duplicates', () => {
  it('f1 handles zero cases', () => {
    expect(f1(0, 0, 0).f1).toBe(0)
    expect(f1(10, 0, 10)).toMatchObject({ precision: 1, recall: 0.5 })
  })
  it('a flag pointing at the wrong original is both a false positive and a false negative', () => {
    const s = duplicateScores([
      { predicted: 'C1', expected: 'C1' },
      { predicted: 'C2', expected: 'C3' },
      { predicted: null, expected: 'C4' },
      { predicted: 'C5', expected: null },
      { predicted: null, expected: null },
    ])
    expect(s).toMatchObject({ tp: 1, fp: 2, fn: 2 })
  })
})
