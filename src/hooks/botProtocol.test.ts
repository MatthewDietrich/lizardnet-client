import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Minimal simulation of the useBotProtocol state machine ───────────────────
// Mirrors the ref-based logic in useBotProtocol exactly so we can test the
// protocol parsing without needing React or a rendered hook.

const BOT_NICK = 'MediaBot'

function createProtocol() {
  let buffer = ''
  const pending: { resolve: (s: string) => void; reject: (e: Error) => void }[] = []

  function handleBotNotice(nick: string | undefined, text: string): boolean {
    if (nick?.toLowerCase() !== BOT_NICK.toLowerCase()) return false
    buffer += text
    const buf = buffer
    const isPresignOk =
      buf.startsWith('PRESIGN_OK ') &&
      /https:\/\/lizardnet-media\.s3\.amazonaws\.com\/[0-9a-f-]+\.\w+$/.test(buf)
    const isComplete =
      isPresignOk || buf === 'DELETE_OK' || /^(PRESIGN_FAIL|DELETE_FAIL)/.test(buf)
    if (!isComplete) return true
    buffer = ''
    const p = pending.shift()
    if (p) {
      if (isPresignOk || buf === 'DELETE_OK') p.resolve(buf)
      else p.reject(new Error(buf.replace(/^(PRESIGN_FAIL|DELETE_FAIL)\s*/, '')))
    }
    return true
  }

  function enqueue(): Promise<string> {
    return new Promise((resolve, reject) => pending.push({ resolve, reject }))
  }

  return { handleBotNotice, enqueue, getBuffer: () => buffer, getPendingCount: () => pending.length }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleBotNotice — routing', () => {
  it('returns false for non-bot nick', () => {
    const p = createProtocol()
    expect(p.handleBotNotice('alice', 'PRESIGN_OK x')).toBe(false)
  })

  it('returns false for undefined nick', () => {
    const p = createProtocol()
    expect(p.handleBotNotice(undefined, 'DELETE_OK')).toBe(false)
  })

  it('is case-insensitive on bot nick', () => {
    const p = createProtocol()
    expect(p.handleBotNotice('MEDIABOT', 'DELETE_OK')).toBe(true)
  })
})

describe('handleBotNotice — DELETE_OK', () => {
  it('resolves pending request with DELETE_OK', async () => {
    const p = createProtocol()
    const promise = p.enqueue()
    p.handleBotNotice(BOT_NICK, 'DELETE_OK')
    await expect(promise).resolves.toBe('DELETE_OK')
  })

  it('clears buffer after resolving', () => {
    const p = createProtocol()
    p.enqueue()
    p.handleBotNotice(BOT_NICK, 'DELETE_OK')
    expect(p.getBuffer()).toBe('')
  })
})

describe('handleBotNotice — PRESIGN_OK', () => {
  const uploadUrl = 'https://s3.amazonaws.com/bucket/file.jpg?sig=abc'
  const publicUrl = 'https://lizardnet-media.s3.amazonaws.com/550e8400-e29b-41d4-a716-446655440000.jpg'

  it('buffers partial message and does not resolve yet', () => {
    const p = createProtocol()
    const promise = p.enqueue()
    p.handleBotNotice(BOT_NICK, 'PRESIGN_OK ')
    // Not complete yet — no public URL
    expect(p.getBuffer()).toBe('PRESIGN_OK ')
    // Promise still pending
    let settled = false
    promise.then(() => { settled = true })
    return Promise.resolve().then(() => expect(settled).toBe(false))
  })

  it('resolves once complete PRESIGN_OK arrives in one notice', async () => {
    const p = createProtocol()
    const promise = p.enqueue()
    p.handleBotNotice(BOT_NICK, `PRESIGN_OK ${uploadUrl} ${publicUrl}`)
    await expect(promise).resolves.toBe(`PRESIGN_OK ${uploadUrl} ${publicUrl}`)
  })

  it('resolves when PRESIGN_OK arrives split across two notices', async () => {
    const p = createProtocol()
    const promise = p.enqueue()
    const full = `PRESIGN_OK ${uploadUrl} ${publicUrl}`
    const mid = Math.floor(full.length / 2)
    p.handleBotNotice(BOT_NICK, full.slice(0, mid))
    p.handleBotNotice(BOT_NICK, full.slice(mid))
    await expect(promise).resolves.toBe(full)
  })
})

describe('handleBotNotice — failures', () => {
  it('rejects on PRESIGN_FAIL with trimmed error message', async () => {
    const p = createProtocol()
    const promise = p.enqueue()
    p.handleBotNotice(BOT_NICK, 'PRESIGN_FAIL Unsupported content type')
    await expect(promise).rejects.toThrow('Unsupported content type')
  })

  it('rejects on DELETE_FAIL with trimmed error message', async () => {
    const p = createProtocol()
    const promise = p.enqueue()
    p.handleBotNotice(BOT_NICK, 'DELETE_FAIL Not authorized')
    await expect(promise).rejects.toThrow('Not authorized')
  })

  it('resolves next queued request after a failure clears the slot', async () => {
    const p = createProtocol()
    const first = p.enqueue()
    const second = p.enqueue()
    p.handleBotNotice(BOT_NICK, 'DELETE_FAIL oops')
    p.handleBotNotice(BOT_NICK, 'DELETE_OK')
    await expect(first).rejects.toThrow('oops')
    await expect(second).resolves.toBe('DELETE_OK')
  })
})

describe('handleBotNotice — no pending request', () => {
  it('does not throw when a response arrives with no pending request', () => {
    const p = createProtocol()
    expect(() => p.handleBotNotice(BOT_NICK, 'DELETE_OK')).not.toThrow()
    expect(p.getPendingCount()).toBe(0)
  })
})
