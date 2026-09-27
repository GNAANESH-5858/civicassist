export type Urgency = 'high' | 'medium' | 'low'

// Weighted keyword rules. Patterns match the lowercased raw text.
// Health/safety hazards (sewage overflow, live wire, contamination) score highest.
export const URGENCY_RULES: { pattern: RegExp; weight: number }[] = [
  { pattern: /sewage|sewer|drainage/, weight: 2 },
  { pattern: /overflow|overflowing|flooding into|entering (our |the )?house/, weight: 2 },
  { pattern: /(sewage|sewer|manhole|drain)\w*.{0,40}(overflow|flowing|leak|burst|spill)|(overflow|leak|burst)\w*.{0,40}(sewage|sewer|manhole)/, weight: 4 },
  { pattern: /live wire|exposed wire|electric shock|electrocut|sparking|hanging wire/, weight: 6 },
  { pattern: /contaminat|dirty water|muddy water|smelly water|foul smell.*water|sewage.*(mix|water)|yellow water/, weight: 6 },
  { pattern: /fire|collapse|collaps|fallen tree|tree fell|accident|injur|bitten|dog bite|attack/, weight: 5 },
  { pattern: /flood|waterlogg|water ?logged|knee.?deep|inundat/, weight: 4 },
  { pattern: /no water|without water|water not (coming|supplied)|no drinking water/, weight: 3 },
  { pattern: /child|children|school|elderly|old age|hospital|pregnan|disabled/, weight: 2 },
  { pattern: /mosquito|dengue|malaria|fever|disease|outbreak|dead animal|carcass/, weight: 3 },
  { pattern: /urgent|emergency|immediately|danger|dangerous|unsafe|hazard/, weight: 2 },
  { pattern: /pothole|dark|streetlight|street light|not working|broken/, weight: 1 },
  { pattern: /garbage|waste|dump|burning|smoke|noise|loud/, weight: 1 },
  { pattern: /(\d+|two|three|four|five|several|many)\s+(days|weeks|months)|for a week|for weeks|since last/, weight: 1 },
]

export const HIGH_AT = 6
export const MEDIUM_AT = 2

export function urgencyScore(text: string): number {
  const t = text.toLowerCase()
  return URGENCY_RULES.reduce((s, r) => (r.pattern.test(t) ? s + r.weight : s), 0)
}

export function classifyUrgency(text: string): Urgency {
  const s = urgencyScore(text)
  return s >= HIGH_AT ? 'high' : s >= MEDIUM_AT ? 'medium' : 'low'
}
