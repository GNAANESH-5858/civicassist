// Rule-based + Naive Bayes triage. Calls NO language model.
import type BayesClassifier from 'natural/lib/natural/classifiers/bayes_classifier.js'
import { predict } from './classifier.ts'
import type { Department } from './departments.ts'
import { findDuplicate, type PriorComplaint } from './duplicates.ts'
import { extractIssue, extractWard } from './entities.ts'
import { maskPII } from './pii.ts'
import { classifyUrgency, type Urgency } from './urgency.ts'

export const MAX_COMPLAINT_CHARS = 2000

export interface TriageResult {
  complaint_id: string
  department: Department | null
  ward: string | null
  issue: string | null
  urgency: Urgency | null
  duplicate_of: string | null
  similarity: number
  masked_text: string
  flags: string[]
  error: string | null
}

const INJECTION_RE =
  /ignore (all |any )?(previous|prior|above|earlier) (instructions|prompts?|rules)|disregard (the |all )?(previous|above|system)|you are now|act as (an? )?(admin|developer|system)|system prompt|reveal (your )?(prompt|instructions)|jailbreak|do anything now/i

export function detectInjection(text: string): boolean {
  return INJECTION_RE.test(text)
}

/** Short stable id from the text and a timestamp. */
export function makeComplaintId(text: string, now = Date.now()): string {
  let h = 2166136261
  for (const ch of `${text}|${now}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return `CMP-${(h >>> 0).toString(36).toUpperCase().padStart(7, '0')}`
}

export interface TriageInput {
  text: unknown
  recent?: PriorComplaint[]
  id?: string
}

export function triage(input: TriageInput, classifier: BayesClassifier): TriageResult {
  const empty = (error: string, masked = ''): TriageResult => ({
    complaint_id: input.id ?? '',
    department: null,
    ward: null,
    issue: null,
    urgency: null,
    duplicate_of: null,
    similarity: 0,
    masked_text: masked,
    flags: [],
    error,
  })

  if (typeof input.text !== 'string' || input.text.trim() === '') return empty('Complaint text is empty.')

  const flags: string[] = []
  let raw = input.text.trim()
  if (raw.length > MAX_COMPLAINT_CHARS) {
    raw = raw.slice(0, MAX_COMPLAINT_CHARS)
    flags.push('truncated')
  }

  // PII is masked FIRST; nothing downstream sees the raw text.
  const { text, counts } = maskPII(raw)
  if (counts.phone) flags.push('phone_masked')
  if (counts.id_number) flags.push('id_masked')
  if (counts.email) flags.push('email_masked')
  if (detectInjection(text)) flags.push('possible_injection')

  try {
    const ward = extractWard(text)
    if (!ward) flags.push('ward_missing')
    const recent = (input.recent ?? []).filter((p) => p && typeof p.text === 'string').slice(-200)
    const dup = findDuplicate(text, ward, recent)
    if (dup.duplicate_of) flags.push('possible_repeat')
    return {
      complaint_id: input.id ?? makeComplaintId(text),
      department: predict(classifier, text),
      ward,
      issue: extractIssue(text),
      urgency: classifyUrgency(text),
      duplicate_of: dup.duplicate_of,
      similarity: dup.similarity,
      masked_text: text,
      flags,
      error: null,
    }
  } catch (e) {
    return { ...empty(`Triage failed: ${e instanceof Error ? e.message : String(e)}`, text), flags }
  }
}
