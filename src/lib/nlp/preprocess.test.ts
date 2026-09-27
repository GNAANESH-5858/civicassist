import { describe, expect, it } from 'vitest'
import { preprocess, removeStopWords, stem, tokenise } from './preprocess.ts'

describe('preprocess', () => {
  it('tokenises lowercase alphanumerics', () => {
    expect(tokenise('No WATER in Ward-12!!')).toEqual(['no', 'water', 'in', 'ward', '12'])
  })

  it('removes stop words but keeps negations', () => {
    expect(removeStopWords(['no', 'water', 'in', 'the', 'street'])).toEqual(['no', 'water', 'street'])
  })

  it('Porter-stems tokens', () => {
    expect(stem(['overflowing', 'collected', 'lights'])).toEqual(['overflow', 'collect', 'light'])
  })

  it('runs the whole pipeline and drops bare numbers', () => {
    expect(preprocess('Sewage is overflowing on the road for 3 days')).toEqual(['sewag', 'overflow', 'road', 'dai'])
  })
})
