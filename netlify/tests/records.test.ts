import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { setStoreForTests, type RecordStore } from '../functions/records.ts'
import type { StoredRecord } from '../../src/lib/records/schema.ts'

const ADMIN = 'a'.repeat(40)
let mem: Map<string, StoredRecord>

function memoryStore(): RecordStore {
  return {
    get: async (k) => structuredClone(mem.get(k) ?? null),
    set: async (k, v) => void mem.set(k, structuredClone(v)),
    delete: async (k) => void mem.delete(k),
    list: async (p) => [...mem.keys()].filter((k) => k.startsWith(p)),
  }
}

const call = (method: string, path: string, body?: unknown, token?: string) =>
  handler(
    new Request(`https://x.test${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )

const valid = { title: 'Sewage overflow in Velachery', summary: 'Sewage overflowing. Call 9876543210', language: 'en', category: 'sewage', authority: 'cmwssb', status: 'ready_to_submit' }

beforeEach(() => {
  mem = new Map()
  setStoreForTests(memoryStore())
})
afterEach(() => {
  setStoreForTests(null)
  vi.unstubAllEnvs()
})

describe('records API', () => {
  it('creates a record, returns a one-time token, stores only its hash, and masks PII', async () => {
    const res = await call('POST', '/api/records', valid)
    expect(res.status).toBe(201)
    const { id, token, record } = (await res.json()) as { id: string; token: string; record: Record<string, unknown> }
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(token.length).toBeGreaterThan(40)
    expect(record.token_hash).toBeUndefined()
    const stored = [...mem.values()][0]
    expect(stored.token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(stored)).not.toContain(token)
    expect(stored.summary).toContain('[PHONE]')
    expect(stored.summary).not.toContain('9876543210')
    expect(stored.history).toEqual([expect.objectContaining({ status: 'ready_to_submit', by: 'citizen' })])
  })

  it('needs the record token to read, update or delete; wrong tokens look like missing records', async () => {
    const { id, token } = (await (await call('POST', '/api/records', valid)).json()) as { id: string; token: string }
    expect((await call('GET', `/api/records/${id}`)).status).toBe(404)
    expect((await call('GET', `/api/records/${id}`, undefined, 'x'.repeat(43))).status).toBe(404)
    expect((await call('GET', `/api/records/${id}`, undefined, token)).status).toBe(200)

    const upd = await call('PATCH', `/api/records/${id}`, { status: 'submitted_externally', external_reference: 'CMW/2026/1', history_note: 'Filed by phone' }, token)
    const rec = ((await upd.json()) as { record: { status: string; history: { by: string; note?: string }[] } }).record
    expect(rec.status).toBe('submitted_externally')
    expect(rec.history.at(-1)).toMatchObject({ by: 'citizen', note: 'Filed by phone' })

    expect((await call('DELETE', `/api/records/${id}`, undefined, token)).status).toBe(200)
    expect(mem.size).toBe(0)
  })

  it('rejects invalid input, unknown fields, oversized bodies and the reserved integration status', async () => {
    expect((await call('POST', '/api/records', { ...valid, title: '' })).status).toBe(400)
    expect((await call('POST', '/api/records', { ...valid, is_admin: true })).status).toBe(400)
    expect((await call('POST', '/api/records', { ...valid, status: 'submitted_via_integration' })).status).toBe(400)
    expect((await call('POST', '/api/records', 'not json')).status).toBe(400)
    expect((await call('POST', '/api/records', { ...valid, summary: 'x'.repeat(20000) })).status).toBe(413)
    expect((await call('GET', '/api/records/not-a-uuid')).status).toBe(404)
  })

  it('admin listing is disabled without a configured token and protected with one', async () => {
    await call('POST', '/api/records', valid)
    vi.stubEnv('CIVICASSIST_ADMIN_TOKEN', '')
    expect((await call('GET', '/api/records', undefined, ADMIN)).status).toBe(503)
    vi.stubEnv('CIVICASSIST_ADMIN_TOKEN', ADMIN)
    expect((await call('GET', '/api/records')).status).toBe(401)
    expect((await call('GET', '/api/records', undefined, 'b'.repeat(40))).status).toBe(401)
    const list = (await (await call('GET', '/api/records', undefined, ADMIN)).json()) as { records: { token_hash?: string }[] }
    expect(list.records).toHaveLength(1)
    expect(list.records[0].token_hash).toBeUndefined()
  })

  it('admin status updates are recorded as admin in the audit trail, but admins cannot delete', async () => {
    vi.stubEnv('CIVICASSIST_ADMIN_TOKEN', ADMIN)
    const { id } = (await (await call('POST', '/api/records', valid)).json()) as { id: string }
    const rec = ((await (await call('PATCH', `/api/records/${id}`, { status: 'in_progress', history_note: 'Checked' }, ADMIN)).json()) as { record: { history: { by: string }[] } }).record
    expect(rec.history.at(-1)?.by).toBe('admin')
    expect((await call('DELETE', `/api/records/${id}`, undefined, ADMIN)).status).toBe(403)
  })
})
