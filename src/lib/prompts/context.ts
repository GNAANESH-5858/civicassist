import type { SchemeRecord } from '../kb/types.ts'

export type ContextRecord = Pick<
  SchemeRecord,
  'id' | 'name' | 'level' | 'authority' | 'complaint_domains' | 'what_it_does' | 'applicability' | 'official_source' | 'page' | 'kind'
>

/** Formats retrieved records as numbered CONTEXT blocks, e.g. "[1] #37 ... (PDF page 12)". */
export function formatContext(records: ContextRecord[]): string {
  return records
    .map((r, i) =>
      [
        `[${i + 1}] Scheme #${r.id}: ${r.name} (PDF page ${r.page})`,
        `Kind: ${r.kind === 'regulatory' ? 'REGULATORY REFERENCE (legal rule, not a benefit)' : 'scheme/programme'}`,
        `Level: ${r.level} | Authority: ${r.authority} | Applicability: ${r.applicability}`,
        `Complaint domains: ${r.complaint_domains}`,
        `What it does: ${r.what_it_does}`,
        `Official source: ${r.official_source}`,
      ].join('\n'),
    )
    .join('\n\n')
}

/** Removes characters that could break out of an XML-style data wrapper. */
export function asData(text: string): string {
  return text.replace(/<\/?(complaint|question|context|draft)[^>]*>/gi, '').replace(/[<>]/g, ' ')
}
