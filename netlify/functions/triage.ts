// Phase 1 stub. Replaced by the real rule-based triage (no language model) in Phase 4.

export const SAMPLE_TRIAGE = {
  complaint_id: 'CMP-SAMPLE-0001',
  department: 'Water Supply & Sewerage',
  ward: 'Ward 12',
  issue: 'no water supply',
  urgency: 'high',
  duplicate_of: null,
  similarity: 0,
  masked_text: 'No water supply in Ward 12 for three days. Call [PHONE].',
  flags: ['stub'],
  error: null,
}

export default async (_req: Request): Promise<Response> => {
  return Response.json(SAMPLE_TRIAGE)
}
