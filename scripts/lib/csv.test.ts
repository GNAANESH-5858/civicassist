import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv.ts'

describe('csv', () => {
  it('round-trips commas, quotes, newlines and nulls', () => {
    const rows = [
      { id: 'C1', text: 'Sir, "urgent"\nplease', n: 3, d: null },
      { id: 'C2', text: 'plain', n: 0, d: 'C1' },
    ]
    const back = parseCsv(toCsv(rows, ['id', 'text', 'n', 'd']))
    expect(back).toEqual([
      { id: 'C1', text: 'Sir, "urgent"\nplease', n: '3', d: '' },
      { id: 'C2', text: 'plain', n: '0', d: 'C1' },
    ])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }])
  })
})
