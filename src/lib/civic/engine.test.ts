import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildFrame, matchesAt } from './frame.ts'
import { asciiDigits, detectLanguage, normalizeText } from './language.ts'
import { findDuration, findLandmark, findLocality, findReference, findWard, parseYesNo } from './lexicon.ts'
import { buildPlan } from './plan.ts'
import { nextQuestions } from './questions.ts'
import { route } from './routing.ts'
import { detectHazards } from './safety.ts'

describe('language', () => {
  it('detects English, Tamil, Hindi and mixed input by script', () => {
    expect(detectLanguage('No water in my street').lang).toBe('en')
    expect(detectLanguage('எங்கள் தெருவில் தண்ணீர் இல்லை').lang).toBe('ta')
    expect(detectLanguage('हमारी गली में पानी नहीं है').lang).toBe('hi')
    const mixed = detectLanguage('Velachery-ல எங்க street-ல light work ஆகல')
    expect(mixed.lang).toBe('ta')
    expect(mixed.mixed).toBe(true)
    expect(detectLanguage('12345').lang).toBeNull()
  })

  it('normalises Tamil and Devanagari digits and the Hindi nukta', () => {
    expect(asciiDigits('௩ நாட்கள், ३ दिन')).toBe('3 நாட்கள், 3 दिन')
    expect(normalizeText('सड़क')).toBe(normalizeText('सड़क'))
  })
})

describe('lexicon', () => {
  it('finds localities in all three scripts and flags ones that may be outside GCC', () => {
    expect(findLocality('pothole in Velachery near the bus stop')?.name).toBe('Velachery')
    expect(findLocality('வேளச்சேரியில் பள்ளம்')?.name).toBe('Velachery')
    expect(findLocality('वेलाचेरी में गड्ढा')?.name).toBe('Velachery')
    expect(findLocality('garbage in Tambaram')?.maybe_outside_gcc).toBe(true)
    expect(findLocality('no water')).toBeNull()
  })

  it('finds wards (1-200 only) in English, Tamil and Hindi', () => {
    expect(findWard('Ward No. 12')).toBe(12)
    expect(findWard('வார்டு 45 இல்')).toBe(45)
    expect(findWard('वार्ड १७८')).toBe(178)
    expect(findWard('ward 450')).toBeNull()
  })

  it('parses durations in three languages', () => {
    expect(findDuration('for three days')).toEqual({ value: 3, unit: 'day' })
    expect(findDuration('மூன்று நாட்களாக')).toEqual({ value: 3, unit: 'day' })
    expect(findDuration('दो हफ़्ते से')).toEqual({ value: 2, unit: 'week' })
    expect(findDuration('ஒரு வாரமாக இருக்கிறது')).toEqual({ value: 1, unit: 'week' })
    expect(findDuration('since yesterday')).toEqual({ value: 1, unit: 'day' })
    expect(findDuration('no water')).toBeNull()
  })

  it('extracts landmarks and earlier complaint references', () => {
    expect(findLandmark('pothole near the Guindy bus stop, very deep')).toBe('Guindy bus stop')
    expect(findLandmark('பேருந்து நிலையம் அருகில் குப்பை')).toBe('பேருந்து நிலையம்')
    expect(findReference('My earlier complaint no. GCC/2026/123456 was closed')).toBe('GCC/2026/123456')
  })

  it('understands yes / no / not sure in three languages', () => {
    expect(parseYesNo('Yes')).toBe('yes')
    expect(parseYesNo('ஆமாம்')).toBe('yes')
    expect(parseYesNo('नहीं')).toBe('no')
    expect(parseYesNo('தெரியாது')).toBe('unknown')
    expect(parseYesNo('maybe later today')).toBeNull()
  })
})

describe('matching', () => {
  it('respects word boundaries (Latin) and word starts (Tamil/Hindi)', () => {
    expect(matchesAt('illegal parking here', 'park')).toBe(false)
    expect(matchesAt('broken street lights', 'street light')).toBe(true)
    expect(matchesAt('चौराहे का सिग्नल खराब', 'नल')).toBe(false)
    expect(matchesAt('नल में पानी नहीं', 'नल')).toBe(true)
    expect(matchesAt('வேளச்சேரியில் பள்ளத்தில்', 'பள்ளத்')).toBe(true)
  })
})

describe('safety', () => {
  it('detects emergencies deterministically in three languages', () => {
    expect(detectHazards('A live wire has fallen on the road')[0]).toMatchObject({ id: 'live_wire', level: 'emergency' })
    expect(detectHazards('மின் கம்பி அறுந்து விழுந்துள்ளது')[0]?.id).toBe('live_wire')
    expect(detectHazards('बिजली का तार गिर गया है')[0]?.id).toBe('live_wire')
    expect(detectHazards('Water is entering our house, people stranded').map((h) => h.id)).toContain('flood_home')
    expect(detectHazards('The manhole is open without a lid')[0]).toMatchObject({ id: 'open_manhole', level: 'urgent' })
    expect(detectHazards('Garbage not collected')).toEqual([])
  })
})

describe('frame and routing', () => {
  it('routes sewage in Velachery to Chennai Metro Water with location and duration', () => {
    const f = buildFrame('There is sewage overflowing outside my house in Velachery. The water has been standing there for three days. Call 9876543210')
    expect(f).toMatchObject({ category: 'sewage', language: 'en', locality: { name: 'Velachery' }, duration: { value: 3, unit: 'day' }, premises: 'public', pii_masked: true })
    expect(f.text).not.toContain('9876543210')
    const r = route(f)
    expect(r.authority.id).toBe('cmwssb')
    expect(r.primary?.id).toBe('cmwssb-phone')
    expect(r.channels.every((c) => c.authority === 'cmwssb')).toBe(true)
  })

  it('gives the same routing for the same complaint in English, Tamil and Hindi', () => {
    const en = route(buildFrame('Big pothole on our street in Velachery for a week'))
    const ta = route(buildFrame('வேளச்சேரியில் எங்கள் தெருவில் ஒரு பெரிய பள்ளம் உள்ளது. அது ஒரு வாரமாக இருக்கிறது.'))
    const hi = route(buildFrame('वेलाचेरी में हमारी सड़क पर एक बड़ा गड्ढा है। यह एक सप्ताह से है।'))
    for (const r of [en, ta, hi]) expect([r.category, r.authority.id, r.department]).toEqual(['roads', 'gcc', 'Roads & Storm Water Drains'])
  })

  it('states jurisdiction uncertainty instead of inventing it', () => {
    const f = buildFrame('Pothole on the road in Tambaram')
    const keys = route(f).uncertainties.map((u) => ('key' in u ? u.key : 'text'))
    expect(keys).toContain('uncertain.outside_gcc')
    expect(keys).toContain('uncertain.road_ownership')
    expect(route(buildFrame('garbage in Ward 12')).uncertainties.map((u) => ('key' in u ? u.key : ''))).toContain('uncertain.ward_stated_not_verified')
  })

  it('changes routing from answers: burning garbage goes to GCC, factory smoke to TNPCB', () => {
    const f = buildFrame('Smoke and fumes every evening near our street')
    expect(route(f).authority.id).toBe('tnpcb')
    const burning = route(f, { pollution_source: 'burning_waste' })
    expect(burning.authority.id).toBe('gcc')
    expect(burning.alternatives[0].authority.id).toBe('tnpcb')
  })

  it('asks the citizen when the classifier is the only signal', () => {
    const f = buildFrame('something is wrong with the supply line', { triageDepartment: 'Water Supply & Sewerage' })
    expect(f.category_source).toBe('classifier')
    expect(f.confidence).toBe('low')
    expect(f.candidates.map((c) => c.id)).toEqual(['water_supply', 'sewage'])
  })

  it('lets the citizen override the category', () => {
    const f = buildFrame('There is a problem near my house', { userCategory: 'streetlight' })
    expect(f).toMatchObject({ category: 'streetlight', confidence: 'high', category_source: 'user' })
  })

  it('puts emergency channels first for a live wire, with the electricity helpline', () => {
    const r = route(buildFrame('A live electric wire is hanging and sparking near the school'))
    expect(r.emergency[0].id).toBe('tnpdcl-phone')
    expect(r.authority.id).toBe('tnpdcl')
  })
})

describe('questions and plan', () => {
  it('asks only relevant, unanswered questions, routing-relevant first', () => {
    const sewage = buildFrame('Sewage overflowing')
    const qs = nextQuestions(sewage, {}).map((q) => q.id)
    expect(qs[0]).toBe('location')
    expect(qs).toContain('public_private')
    expect(qs).not.toContain('connection_number')
    expect(nextQuestions(sewage, { location: 'Adyar', public_private: 'public' }).map((q) => q.id)).not.toContain('location')
    // location and duration already in the text are not asked again
    expect(nextQuestions(buildFrame('Garbage not collected in Adyar for a week'), {}).map((q) => q.id)).not.toContain('location')
  })

  it('builds an actionable plan with the verified channel and no invented timeline', () => {
    const f = buildFrame('Street light not working in Mylapore')
    const plan = buildPlan(f, route(f))
    expect(plan.map((s) => s.id)).toEqual(['gather', 'submit', 'save', 'follow_up', 'timeline', 'escalate'])
    expect(plan.find((s) => s.id === 'submit')?.params).toMatchObject({ channel: 'gcc-pgr-online', authority: 'gcc' })
    expect(plan.find((s) => s.id === 'timeline')?.key).toBe('plan.no_timeline')
  })
})

describe('multilingual routing (development set, SYNTHETIC)', () => {
  const { items } = JSON.parse(readFileSync('eval/multilingual_routing.json', 'utf8')) as { items: { id: string; text: string; category: string; authority: string }[] }
  it('routes every development example to the expected authority', () => {
    const wrong = items.filter((it) => route(buildFrame(it.text)).authority.id !== it.authority).map((it) => it.id)
    expect(wrong).toEqual([])
  })
})
