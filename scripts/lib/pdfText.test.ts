import { describe, expect, it } from 'vitest'
import { itemsToLines } from './pdfText.ts'

const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] })

describe('itemsToLines', () => {
  it('groups items by y (top first) and orders each line by x', () => {
    const lines = itemsToLines([item('world', 60, 700), item('second', 10, 680), item('hello ', 10, 700.5), item('', 0, 650)])
    expect(lines).toEqual(['hello world', 'second'])
  })

  it('collapses repeated whitespace', () => {
    expect(itemsToLines([item('Level: Central', 10, 500), item('    Authority: MoHUA', 90, 500)])).toEqual([
      'Level: Central Authority: MoHUA',
    ])
  })
})
