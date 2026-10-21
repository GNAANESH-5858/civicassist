// CivicAssist Guide: a deterministic dialogue manager. Bot turns are structured (kind + data) and
// rendered in the current language at display time, so switching language re-renders the whole
// conversation while keeping its context. Free text is understood by the rules-based frame
// (optionally improved by AI before the event is dispatched); procedures come only from the
// knowledge base via route()/buildPlan().
import { buildFrame, type ComplaintFrame } from './frame.ts'
import { normalizeText } from './language.ts'
import { parseYesNo } from './lexicon.ts'
import { nextQuestions, questionDef, type QuestionId } from './questions.ts'
import type { Answers } from './routing.ts'

export type BotKind =
  | 'greeting'
  | 'ask_describe'
  | 'ask_describe_category'
  | 'emergency'
  | 'understood'
  | 'ask_category'
  | 'question'
  | 'question_retry'
  | 'recommendation'
  | 'offer_next'
  | 'scheme_query'
  | 'followup_help'
  | 'letter_help'
  | 'correction'

export type Turn =
  | { role: 'user'; text: string }
  | { role: 'bot'; kind: BotKind; data?: Record<string, unknown> }

export interface DialogueState {
  mode: 'complaint' | 'schemes' | 'followup'
  description: string
  frame: ComplaintFrame | null
  userCategory: string | null
  answers: Answers
  pending: QuestionId | null
  asked: QuestionId[]
  turns: Turn[]
}

export type QuickStart = 'roads' | 'garbage' | 'drainage_flooding' | 'water_supply' | 'streetlight' | 'sewage' | 'electricity' | 'traffic' | 'schemes' | 'followup' | 'letter'

export type DialogueEvent =
  | { type: 'user_text'; text: string; frame?: ComplaintFrame }
  | { type: 'choose_category'; category: string }
  | { type: 'answer'; question: QuestionId; value: string }
  | { type: 'skip' }
  | { type: 'quick_start'; id: QuickStart }
  | { type: 'correct'; field: 'category' | 'location' | 'description' }
  | { type: 'restart' }

export const MAX_QUESTIONS = 4

export function initialState(): DialogueState {
  return { mode: 'complaint', description: '', frame: null, userCategory: null, answers: {}, pending: null, asked: [], turns: [{ role: 'bot', kind: 'greeting' }] }
}

const SCHEME_INTENT = /\b(scheme|schemes|subsidy|pension|scholarship|yojana|welfare|benefit|eligib\w*)\b|திட்ட|உதவித்தொகை|ஓய்வூதிய|மானிய|योजना|सब्सिडी|पेंशन|छात्रवृत्ति|लाभ/i
const FOLLOWUP_INTENT = /\b(follow ?up|no response|not resolved|still not|ignored|nobody came|escalat\w*|already complained|earlier complaint)\b|பதில் இல்லை|தீர்க்கப்படவில்லை|ஏற்கனவே புகார்|जवाब नहीं|कोई कार्रवाई नहीं|पहले शिकायत|अभी तक हल नहीं/i

export function detectIntent(text: string): 'schemes' | 'followup' | 'complaint' {
  if (FOLLOWUP_INTENT.test(text)) return 'followup'
  if (SCHEME_INTENT.test(text)) return 'schemes'
  return 'complaint'
}

// Free-text answers to choice questions, in English, Tamil and Hindi.
const CHOICE_WORDS: Record<string, Record<string, RegExp>> = {
  public_private: {
    public: /public|road|street|outside|lane|footpath|தெரு|சாலை|வெளியே|सड|गली|बाहर|सार्वजनिक/,
    private: /private|inside|my house|our house|compound|apartment|flat|வீட்டுக்குள்|உள்ளே|தனியார்|अंदर|निजी|मेरे घर/,
    unknown: /not sure|don't know|dont know|தெரியாது|पता नहीं/,
  },
  road_type: {
    highway: /highway|national|நெடுஞ்சாலை|राजमार्ग|हाईवे/,
    main: /main|bus|arterial|முதன்மை|பேருந்து|मुख्य|बस/,
    residential: /residential|small|lane|street|colony|குடியிருப்பு|தெரு|गली|कॉलोनी/,
    unknown: /not sure|don't know|தெரியாது|पता नहीं/,
  },
  pollution_source: {
    factory: /factory|industr|plant|unit|தொழிற்சாலை|ஆலை|फैक्ट्री|कारखान|प्लांट/,
    burning_waste: /burn|garbage|plastic|எரி|குப்பை|जला|कचरा/,
    vehicles: /vehicle|traffic|bus|lorry|வாகன|गाड|वाहन/,
    construction: /construction|dust|building|கட்டுமான|தூசி|निर्माण|धूल/,
    other: /other|something else|வேறு|अन्य|कुछ और/,
  },
  started: {
    today: /today|this morning|இன்று|आज/,
    few_days: /few days|days ago|yesterday|சில நாட்கள்|நேற்று|कुछ दिन|कल/,
    week: /week|வார|हफ्त|सप्ताह/,
    month_plus: /month|year|மாத|ஆண்டு|महीन|साल/,
    unknown: /not sure|don't know|தெரியாது|पता नहीं/,
  },
}

export function parseAnswer(question: QuestionId, text: string): string | null {
  const def = questionDef(question)
  const t = normalizeText(text)
  if (!t) return null
  if (def.kind === 'yesno') return parseYesNo(t)
  if (def.kind === 'choice') {
    const words = CHOICE_WORDS[question] ?? {}
    for (const opt of def.options ?? []) if (words[opt]?.test(t) || t === opt) return opt
    return null
  }
  return text.trim().slice(0, 200)
}

function bot(kind: BotKind, data?: Record<string, unknown>): Turn {
  return { role: 'bot', kind, data }
}

/** Asks the next relevant question, or gives the recommendation when none remain. */
function advance(s: DialogueState): DialogueState {
  if (!s.frame) return { ...s, turns: [...s.turns, bot('ask_describe')] }
  const remaining = nextQuestions(s.frame, s.answers, MAX_QUESTIONS).filter((q) => !s.asked.includes(q.id))
  if (s.asked.length < MAX_QUESTIONS && remaining.length) {
    const q = remaining[0]
    return { ...s, pending: q.id, asked: [...s.asked, q.id], turns: [...s.turns, bot('question', { id: q.id })] }
  }
  return { ...s, pending: null, turns: [...s.turns, bot('recommendation', { answers: { ...s.answers } }), bot('offer_next')] }
}

function understand(s: DialogueState, frame: ComplaintFrame): DialogueState {
  const turns: Turn[] = [...s.turns]
  if (frame.safety !== 'none') turns.push(bot('emergency', { hazards: frame.hazards.map((h) => h.id), level: frame.safety }))
  turns.push(bot('understood'))
  const next = { ...s, frame, turns }
  if (frame.confidence === 'low' && !s.userCategory) {
    return { ...next, turns: [...next.turns, bot('ask_category', { candidates: frame.candidates.map((c) => c.id) })] }
  }
  return advance(next)
}

export function reduce(s: DialogueState, e: DialogueEvent): DialogueState {
  switch (e.type) {
    case 'restart':
      return initialState()

    case 'quick_start': {
      if (e.id === 'schemes') return { ...s, mode: 'schemes', turns: [...s.turns, bot('scheme_query')] }
      if (e.id === 'followup') return { ...s, mode: 'followup', turns: [...s.turns, bot('followup_help', { authority: s.frame ? null : null })] }
      if (e.id === 'letter') return { ...s, turns: [...s.turns, bot('letter_help')] }
      const next = { ...s, mode: 'complaint' as const, userCategory: e.id }
      if (s.description) return understand(next, buildFrame(s.description, { userCategory: e.id }))
      return { ...next, turns: [...s.turns, bot('ask_describe_category', { category: e.id })] }
    }

    case 'choose_category': {
      const frame = buildFrame(s.description || '', { userCategory: e.category })
      const merged = s.frame ? { ...s.frame, category: e.category, confidence: 'high' as const, category_source: 'user' as const } : frame
      return advance({ ...s, userCategory: e.category, frame: merged, turns: [...s.turns, bot('correction', { field: 'category', category: e.category })] })
    }

    case 'answer': {
      const answers = { ...s.answers, [e.question]: e.value } as Answers
      return advance({ ...s, answers, pending: null })
    }

    case 'skip': {
      if (!s.pending) return s
      return advance({ ...s, pending: null })
    }

    case 'correct': {
      if (e.field === 'category') return { ...s, turns: [...s.turns, bot('ask_category', { candidates: s.frame?.candidates.map((c) => c.id) ?? [] })] }
      if (e.field === 'location') {
        const answers = { ...s.answers }
        delete answers.location
        return { ...s, answers, pending: 'location', turns: [...s.turns, bot('question', { id: 'location' })] }
      }
      return { ...s, description: '', frame: null, answers: {}, asked: [], pending: null, turns: [...s.turns, bot('ask_describe')] }
    }

    case 'user_text': {
      const text = e.text.trim()
      if (!text) return s
      const withUser = { ...s, turns: [...s.turns, { role: 'user' as const, text }] }
      if (s.pending) {
        const value = parseAnswer(s.pending, text)
        if (value) return reduce(withUser, { type: 'answer', question: s.pending, value })
        // Not an answer to the question: treat as more description, re-ask once.
        const description = `${s.description} ${text}`.trim()
        const frame = e.frame ?? buildFrame(description, { userCategory: s.userCategory })
        return { ...withUser, description, frame, turns: [...withUser.turns, bot('question_retry', { id: s.pending })] }
      }
      const intent = s.description ? (detectIntent(text) === 'complaint' ? 'complaint' : detectIntent(text)) : detectIntent(text)
      if (intent === 'schemes' && s.mode !== 'complaint') return { ...withUser, mode: 'schemes', turns: [...withUser.turns, bot('scheme_query', { query: text })] }
      if (intent === 'schemes' && !s.description) return { ...withUser, mode: 'schemes', turns: [...withUser.turns, bot('scheme_query', { query: text })] }
      if (intent === 'followup' && !s.description) {
        const description = text
        const frame = e.frame ?? buildFrame(description)
        return { ...withUser, mode: 'followup', description, frame, turns: [...withUser.turns, bot('followup_help')] }
      }
      if (s.mode === 'schemes') return { ...withUser, turns: [...withUser.turns, bot('scheme_query', { query: text })] }
      const description = `${s.description} ${text}`.trim()
      const frame = e.frame ?? buildFrame(description, { userCategory: s.userCategory })
      return understand({ ...withUser, mode: 'complaint', description }, frame)
    }
  }
}
