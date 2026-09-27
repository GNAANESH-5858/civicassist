import { describe, expect, it } from 'vitest'
import { classifyUrgency, urgencyScore } from './urgency.ts'

describe('urgency', () => {
  it.each([
    ['Sewage overflowing onto the street', 'high'],
    ['Live wire hanging near the school', 'high'],
    ['Contaminated drinking water coming from tap', 'high'],
    ['Streets flooding and waterlogging after rain', 'medium'],
    ['No water supply for three days', 'medium'],
    ['Pothole on the main road', 'low'],
    ['Park benches need painting', 'low'],
  ])('%s -> %s', (text, level) => {
    expect(classifyUrgency(text)).toBe(level)
  })

  it('scores hazards above nuisances', () => {
    expect(urgencyScore('live wire')).toBeGreaterThan(urgencyScore('loud noise at night'))
  })
})
