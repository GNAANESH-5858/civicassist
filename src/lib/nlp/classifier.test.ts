import { describe, expect, it } from 'vitest'
import { evaluate, predict, restore, seededShuffle, split, train } from './classifier.ts'

const rows = [
  { text: 'no water supply in the tap', department: 'Water Supply & Sewerage' },
  { text: 'drinking water not coming', department: 'Water Supply & Sewerage' },
  { text: 'sewage overflowing from manhole', department: 'Water Supply & Sewerage' },
  { text: 'garbage not collected from street', department: 'Solid Waste Management' },
  { text: 'waste bins overflowing with garbage', department: 'Solid Waste Management' },
  { text: 'garbage dumped near school', department: 'Solid Waste Management' },
]

describe('classifier', () => {
  it('learns departments and survives a JSON round trip', () => {
    const c = train(rows)
    expect(predict(c, 'water not supplied today')).toBe('Water Supply & Sewerage')
    const r = restore(JSON.parse(JSON.stringify(c)))
    expect(predict(r, 'garbage everywhere')).toBe('Solid Waste Management')
  })

  it('computes accuracy and a confusion matrix', () => {
    const c = train(rows)
    const e = evaluate(c, rows, ['Water Supply & Sewerage', 'Solid Waste Management'])
    expect(e.accuracy).toBe(1)
    expect(e.matrix).toEqual([
      [3, 0],
      [0, 3],
    ])
  })
})

describe('keyword rules', () => {
  it('route unambiguous terms before Naive Bayes', async () => {
    const { keywordDepartment } = await import('./classifier.ts')
    const c = train(rows)
    expect(keywordDepartment('sewer overflowing onto the street')).toBe('Water Supply & Sewerage')
    expect(predict(c, 'sewer overflowing like garbage bins')).toBe('Water Supply & Sewerage')
    expect(keywordDepartment('broken streetlight')).toBe('Street Lighting')
    expect(keywordDepartment('garbage everywhere')).toBeNull()
  })
})

describe('split', () => {
  it('holds out ~20% of each label, deterministically', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ text: `t${i}`, department: i % 2 ? 'A' : 'B' }))
    const a = split(many)
    const b = split(many)
    expect(a.test).toHaveLength(4)
    expect(a.test.filter((r) => r.department === 'A')).toHaveLength(2)
    expect(a.train).toHaveLength(16)
    expect(a.test).toEqual(b.test)
  })

  it('seededShuffle is a permutation', () => {
    expect(seededShuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5])
  })
})
