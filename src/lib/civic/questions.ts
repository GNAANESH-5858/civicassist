// Conditional follow-up questions. Only questions that change the routing or improve the letter,
// only for the categories they apply to, and never one the complaint already answers.
import { categoryOf, type ComplaintFrame } from './frame.ts'
import type { Answers } from './routing.ts'

export type QuestionId = keyof Answers

export interface Question {
  id: QuestionId
  kind: 'text' | 'choice' | 'yesno'
  /** Choice values; labels come from translations (guidance:question.<id>.option.<value>). */
  options?: string[]
  /** Questions that can change which authority is recommended are asked first. */
  affects_routing: boolean
  optional: boolean
}

const DEFS: Record<QuestionId, Question> = {
  location: { id: 'location', kind: 'text', affects_routing: true, optional: false },
  public_private: { id: 'public_private', kind: 'choice', options: ['public', 'private', 'unknown'], affects_routing: true, optional: false },
  road_type: { id: 'road_type', kind: 'choice', options: ['residential', 'main', 'highway', 'unknown'], affects_routing: true, optional: false },
  pollution_source: { id: 'pollution_source', kind: 'choice', options: ['factory', 'burning_waste', 'vehicles', 'construction', 'other'], affects_routing: true, optional: false },
  danger: { id: 'danger', kind: 'yesno', affects_routing: true, optional: false },
  landmark: { id: 'landmark', kind: 'text', affects_routing: false, optional: true },
  started: { id: 'started', kind: 'choice', options: ['today', 'few_days', 'week', 'month_plus', 'unknown'], affects_routing: false, optional: true },
  ongoing: { id: 'ongoing', kind: 'yesno', affects_routing: false, optional: true },
  affects_vulnerable: { id: 'affects_vulnerable', kind: 'yesno', affects_routing: false, optional: true },
  previous_complaint: { id: 'previous_complaint', kind: 'text', affects_routing: false, optional: true },
  connection_number: { id: 'connection_number', kind: 'text', affects_routing: false, optional: true },
}

/** True when the frame already contains the answer to this question. */
function answeredByFrame(id: QuestionId, f: ComplaintFrame): boolean {
  switch (id) {
    case 'location':
      return Boolean(f.locality || f.ward)
    case 'landmark':
      return Boolean(f.landmark)
    case 'started':
      return Boolean(f.duration)
    case 'public_private':
      return f.premises !== null
    case 'previous_complaint':
      return Boolean(f.previous_reference)
    case 'danger':
      return f.safety !== 'none'
    default:
      return false
  }
}

/**
 * Remaining questions for this complaint, routing-relevant first. `limit` caps how many are
 * proposed in the guided flow (the rest are available as "add more details").
 */
export function nextQuestions(frame: ComplaintFrame, answers: Answers, limit = 4): Question[] {
  const cat = categoryOf(frame)
  const qs = cat.questions
    .map((id) => DEFS[id as QuestionId])
    .filter((q): q is Question => Boolean(q))
    .filter((q) => answers[q.id] === undefined && !answeredByFrame(q.id, frame))
  qs.sort((a, b) => Number(b.affects_routing) - Number(a.affects_routing))
  return qs.slice(0, limit)
}

export function questionDef(id: QuestionId): Question {
  return DEFS[id]
}
