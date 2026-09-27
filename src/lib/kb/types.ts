/** One knowledge-base entry, parsed from the scheme master PDF. One record per entry, never chunked. */
export interface SchemeRecord {
  id: number
  name: string
  level: string
  authority: string
  complaint_domains: string
  what_it_does: string
  matching_signals: string
  applicability: string
  official_source: string
  /** PDF page the entry appears on, used for citations. */
  page: number
  kind: 'scheme' | 'regulatory'
  geography: 'urban' | 'rural' | 'both'
}
