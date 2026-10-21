// Report-workflow state kept in this browser so citizens can leave and come back.
import { readJson, writeJson, type KV, defaultStore } from '../browser/storage.ts'
import type { AssistedFrame } from './assist.ts'
import type { Answers } from './routing.ts'

export const STEPS = ['describe', 'clarify', 'recommend', 'letter', 'submit', 'track'] as const
export type Step = (typeof STEPS)[number]

export interface ReportState {
  step: Step
  text: string
  userCategory: string | null
  frame: AssistedFrame | null
  triageDepartment: string | null
  complaintId: string | null
  answers: Answers
  submitted: { status: 'ready_to_submit' | 'submitted_externally'; channel_id: string | null; reference: string; date: string } | null
  savedRecordId: string | null
}

export const REPORT_KEY = 'civicassist.report.v1'

export function emptyReport(): ReportState {
  return { step: 'describe', text: '', userCategory: null, frame: null, triageDepartment: null, complaintId: null, answers: {}, submitted: null, savedRecordId: null }
}

export function loadReport(store: KV | null = defaultStore()): ReportState {
  const r = readJson<ReportState | null>(REPORT_KEY, null, store)
  return r && STEPS.includes(r.step) ? { ...emptyReport(), ...r } : emptyReport()
}

export function saveReport(r: ReportState, store: KV | null = defaultStore()): void {
  writeJson(REPORT_KEY, r, store)
}

/** The step a citizen may open: they can always go back, and forward only once earlier steps exist. */
export function stepEnabled(r: ReportState, s: Step): boolean {
  const i = STEPS.indexOf(s)
  if (i === 0) return true
  if (!r.frame) return false
  return i <= 4 || Boolean(r.submitted)
}
