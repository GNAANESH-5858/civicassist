// Loads the knowledge base and search index from public/data (once per page load).
import { embed } from '../embed.ts'
import type { SchemeRecord } from '../kb/types.ts'
import type { RetrieveDeps } from '../rag/retrieve.ts'
import type { SearchIndex } from '../search/rank.ts'

let kbPromise: Promise<RetrieveDeps> | null = null

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`)
  return res.json() as Promise<T>
}

export function loadKb(): Promise<RetrieveDeps> {
  if (!kbPromise) {
    kbPromise = Promise.all([getJson<SchemeRecord[]>('/data/schemes.json'), getJson<SearchIndex>('/data/index.json')]).then(
      ([records, index]) => ({ records, index, embed }),
    )
    kbPromise.catch(() => {
      kbPromise = null
    })
  }
  return kbPromise
}
