import { describe, expect, it } from 'vitest'
import { searchText } from './searchText.ts'

describe('searchText', () => {
  it('joins complaint domains and matching signals', () => {
    expect(searchText({ complaint_domains: 'Water supply', matching_signals: 'No-water, low pressure.' })).toBe(
      'Water supply. No-water, low pressure.',
    )
  })

  it('ignores name and description so generic words do not drown the signals', () => {
    const r = { name: 'AMRUT 2.0', what_it_does: 'Urban water mission.', complaint_domains: 'Water supply', matching_signals: 'No-water.' }
    expect(searchText(r)).not.toContain('AMRUT')
    expect(searchText(r)).not.toContain('mission')
  })
})
