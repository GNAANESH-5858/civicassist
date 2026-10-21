// Browser client for /api/records. The record id + secret token (the "private link") are kept in
// this browser only; anyone with the link can open the record, so it is shown as a private link.
import type { ComplaintRecord, RecordInput, RecordUpdate } from '../records/schema.ts'
import { readJson, writeJson, type KV, defaultStore } from './storage.ts'

export const SAVED_KEY = 'civicassist.records.v1'

export interface SavedRef {
  id: string
  token: string
  title: string
  saved_at: string
}

export function savedRecords(store: KV | null = defaultStore()): SavedRef[] {
  const v = readJson<SavedRef[]>(SAVED_KEY, [], store)
  return Array.isArray(v) ? v : []
}

export function rememberRecord(ref: SavedRef, store: KV | null = defaultStore()): void {
  writeJson(SAVED_KEY, [ref, ...savedRecords(store).filter((r) => r.id !== ref.id)].slice(0, 200), store)
}

export function forgetRecord(id: string, store: KV | null = defaultStore()): void {
  writeJson(SAVED_KEY, savedRecords(store).filter((r) => r.id !== id), store)
}

/** Private link format: /my-complaints#r=<id>.<token> (the fragment is never sent to the server). */
export function privateLink(origin: string, ref: Pick<SavedRef, 'id' | 'token'>): string {
  return `${origin}/my-complaints#r=${ref.id}.${ref.token}`
}

export function parsePrivateLink(text: string): { id: string; token: string } | null {
  const m = /r=([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,})/.exec(text)
  return m ? { id: m[1], token: m[2] } : null
}

export class RecordsError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(method: string, path: string, token?: string, body?: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // non-JSON error page
  }
  if (!res.ok) throw new RecordsError(res.status, (data as { error?: string })?.error ?? `HTTP ${res.status}`)
  return data as T
}

export const recordsApi = {
  create: (input: RecordInput, f?: typeof fetch) => call<{ id: string; token: string; record: ComplaintRecord }>('POST', '/api/records', undefined, input, f),
  get: (id: string, token: string, f?: typeof fetch) => call<{ record: ComplaintRecord }>('GET', `/api/records/${id}`, token, undefined, f),
  update: (id: string, token: string, u: RecordUpdate, f?: typeof fetch) => call<{ record: ComplaintRecord }>('PATCH', `/api/records/${id}`, token, u, f),
  remove: (id: string, token: string, f?: typeof fetch) => call<{ deleted: boolean }>('DELETE', `/api/records/${id}`, token, undefined, f),
  adminList: (adminToken: string, f?: typeof fetch) => call<{ records: ComplaintRecord[] }>('GET', '/api/records', adminToken, undefined, f),
  adminUpdate: (id: string, adminToken: string, u: RecordUpdate, f?: typeof fetch) => call<{ record: ComplaintRecord }>('PATCH', `/api/records/${id}`, adminToken, u, f),
}
