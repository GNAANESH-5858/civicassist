import { describe, expect, it } from 'vitest'
import { detectIntent, initialState, parseAnswer, reduce, type DialogueEvent, type DialogueState } from './dialogue.ts'

const run = (events: DialogueEvent[], s: DialogueState = initialState()) => events.reduce(reduce, s)
const kinds = (s: DialogueState) => s.turns.map((t) => (t.role === 'user' ? 'user' : t.kind))

describe('dialogue manager', () => {
  it('understands a complaint, asks only relevant questions, then recommends', () => {
    let s = run([{ type: 'user_text', text: 'Sewage overflowing outside my house in Velachery for three days' }])
    expect(s.frame?.category).toBe('sewage')
    expect(kinds(s)).toEqual(['greeting', 'user', 'understood', 'question'])
    // location, duration and "outside my house" (public) are already known, so none of those are asked
    expect(s.pending).toBe('landmark')
    expect(s.asked).not.toContain('public_private')
    s = reduce(s, { type: 'user_text', text: 'opposite the Vijayanagar bus stop' })
    expect(s.answers.landmark).toBe('opposite the Vijayanagar bus stop')
    while (s.pending) s = reduce(s, { type: 'skip' })
    expect(kinds(s).slice(-2)).toEqual(['recommendation', 'offer_next'])
    expect(s.asked.length).toBeLessThanOrEqual(4)
  })

  it('handles Tamil and Hindi answers to choice and yes/no questions', () => {
    expect(parseAnswer('public_private', 'தெருவில் தான்')).toBe('public')
    expect(parseAnswer('public_private', 'घर के अंदर')).toBe('private')
    expect(parseAnswer('danger', 'இல்லை')).toBe('no')
    expect(parseAnswer('ongoing', 'हाँ')).toBe('yes')
    expect(parseAnswer('road_type', 'बस वाली मुख्य सड़क')).toBe('main')
    expect(parseAnswer('danger', 'what do you mean')).toBeNull()
  })

  it('asks for the category when unsure, and accepts a correction', () => {
    let s = run([{ type: 'user_text', text: 'there is a problem near my house' }])
    expect(kinds(s).at(-1)).toBe('ask_category')
    s = reduce(s, { type: 'choose_category', category: 'garbage' })
    expect(s.frame?.category).toBe('garbage')
    expect(s.frame?.category_source).toBe('user')
    expect(kinds(s)).toContain('correction')
  })

  it('shows emergency guidance first for a live wire, in any language', () => {
    const s = run([{ type: 'user_text', text: 'मेरी गली में बिजली का तार गिर गया है' }])
    expect(kinds(s).slice(2, 4)).toEqual(['emergency', 'understood'])
    expect(s.frame?.language).toBe('hi')
  })

  it('switches to scheme questions and follow-up help by intent', () => {
    expect(detectIntent('Which government scheme can help my family?')).toBe('schemes')
    expect(detectIntent('என் குடும்பத்திற்கு எந்த அரசு திட்டம் உதவும்?')).toBe('schemes')
    expect(detectIntent('I complained 2 weeks ago and nobody came')).toBe('followup')
    const s = run([{ type: 'user_text', text: 'मेरे परिवार के लिए कौन-सी सरकारी योजना उपयोगी हो सकती है?' }])
    expect(s.mode).toBe('schemes')
    expect(kinds(s).at(-1)).toBe('scheme_query')
  })

  it('quick starts set the category and ask for a description', () => {
    let s = run([{ type: 'quick_start', id: 'streetlight' }])
    expect(kinds(s).at(-1)).toBe('ask_describe_category')
    s = reduce(s, { type: 'user_text', text: 'outside 14 Gandhi Street, Adyar, dark for a week' })
    expect(s.frame?.category).toBe('streetlight')
  })

  it('treats a non-answer as more description and re-asks', () => {
    let s = run([{ type: 'user_text', text: 'Water problem' }])
    const pending = s.pending
    if (pending === 'location') {
      s = reduce(s, { type: 'user_text', text: 'Adyar, 3rd Main Road' })
      expect(s.answers.location).toBe('Adyar, 3rd Main Road')
    }
    s = run([{ type: 'user_text', text: 'Sewage overflowing in Velachery for 2 days' }])
    s = reduce(s, { type: 'user_text', text: 'the smell is very bad' })
    expect(kinds(s).at(-1)).toBe('question_retry')
    expect(s.description).toContain('smell')
  })

  it('lets the citizen change the location and restart', () => {
    let s = run([{ type: 'user_text', text: 'Garbage not collected in Adyar' }, { type: 'answer', question: 'location', value: 'Adyar' }])
    s = reduce(s, { type: 'correct', field: 'location' })
    expect(s.pending).toBe('location')
    expect(s.answers.location).toBeUndefined()
    expect(reduce(s, { type: 'restart' }).turns).toEqual([{ role: 'bot', kind: 'greeting' }])
  })
})
