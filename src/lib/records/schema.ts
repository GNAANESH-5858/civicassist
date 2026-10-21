// Complaint record schema shared by the records function and the browser.
// Records hold the citizen's own tracking notes about a complaint they filed THEMSELVES with an
// official channel. CivicAssist does not submit complaints, so "submitted_via_integration" is
// reserved and cannot be set by anyone.
import { z } from 'zod'

export const STATUSES = ['draft', 'ready_to_submit', 'submitted_externally', 'submitted_via_integration', 'acknowledged', 'in_progress', 'resolved', 'closed', 'unknown'] as const
export type Status = (typeof STATUSES)[number]
/** Statuses a citizen or admin may set. 'submitted_via_integration' needs a real integration, which does not exist. */
export const SETTABLE_STATUSES = STATUSES.filter((s) => s !== 'submitted_via_integration') as Exclude<Status, 'submitted_via_integration'>[]

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const RecordInputSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().min(3).max(2000),
    language: z.enum(['en', 'ta', 'hi']),
    category: z.string().max(40),
    authority: z.string().max(40),
    department: z.string().max(60).nullable().optional(),
    channel_id: z.string().max(60).nullable().optional(),
    locality: z.string().trim().max(80).nullable().optional(),
    status: z.enum(SETTABLE_STATUSES as [string, ...string[]]).default('draft'),
    external_reference: z.string().trim().max(60).nullable().optional(),
    submitted_on: isoDate.nullable().optional(),
    follow_up_on: isoDate.nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
export type RecordInput = z.infer<typeof RecordInputSchema>

export const RecordUpdateSchema = z
  .object({
    status: z.enum(SETTABLE_STATUSES as [string, ...string[]]).optional(),
    external_reference: z.string().trim().max(60).nullable().optional(),
    submitted_on: isoDate.nullable().optional(),
    follow_up_on: isoDate.nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    resolution_notes: z.string().trim().max(1000).nullable().optional(),
    /** Note attached to this status change in the history. */
    history_note: z.string().trim().max(300).optional(),
  })
  .strict()
export type RecordUpdate = z.infer<typeof RecordUpdateSchema>

export interface HistoryEntry {
  at: string
  status: Status
  /** 'citizen' = reported by the citizen; 'admin' = set by a CivicAssist administrator. Neither is a government confirmation. */
  by: 'citizen' | 'admin'
  note?: string
}

export interface ComplaintRecord extends Omit<RecordInput, 'status'> {
  id: string
  status: Status
  created_at: string
  updated_at: string
  resolution_notes?: string | null
  history: HistoryEntry[]
  /** Always false for records created through the API; sample data lives elsewhere. */
  is_sample: false
}

export interface StoredRecord extends ComplaintRecord {
  token_hash: string
}

export function publicView(r: StoredRecord): ComplaintRecord {
  const { token_hash: _hidden, ...rest } = r
  return rest
}
