import type { SchemeRecord } from './types.ts'

/**
 * Text embedded for each record: complaint domains + matching signals.
 * matching_signals was written to describe how citizens phrase these complaints.
 * Name and what_it_does are deliberately left out: in Gate 3 their generic words
 * ("water", "urban") drowned the signals, e.g. "no water in my street" ranked the
 * water-supply scheme 19th with them and 1st without them.
 */
export function searchText(r: Pick<SchemeRecord, 'complaint_domains' | 'matching_signals'>): string {
  return [r.complaint_domains, r.matching_signals].join('. ')
}
