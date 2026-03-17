import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Minimal simulation of the typing-state logic in useIrcUsers ───────────────
// Mirrors handleTypingUser and handlePmTyping exactly so we can drive them
// with fake timers without needing React or renderHook.

const TYPING_TIMEOUT = 6_000

function createTypingState() {
  let users: string[] = []
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function handleTypingUser(who: string, state: string | undefined) {
    clearTimeout(timers.get(who))
    timers.delete(who)
    if (!state || state === 'done') {
      users = users.filter(u => u !== who)
      return
    }
    if (!users.includes(who)) users = [...users, who]
    timers.set(who, setTimeout(() => {
      timers.delete(who)
      users = users.filter(u => u !== who)
    }, TYPING_TIMEOUT))
  }

  function getUsers() { return users }
  return { handleTypingUser, getUsers }
}

function createPmTypingState() {
  let peers = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function handlePmTyping(who: string, state: string | undefined) {
    clearTimeout(timers.get(who))
    timers.delete(who)
    if (!state || state === 'done') {
      peers = new Set([...peers].filter(p => p !== who))
      return
    }
    peers = new Set([...peers, who])
    timers.set(who, setTimeout(() => {
      timers.delete(who)
      peers = new Set([...peers].filter(p => p !== who))
    }, TYPING_TIMEOUT))
  }

  function getPeers() { return peers }
  return { handlePmTyping, getPeers }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('handleTypingUser — channel', () => {
  it('adds user on active state', () => {
    const { handleTypingUser, getUsers } = createTypingState()
    handleTypingUser('alice', 'active')
    expect(getUsers()).toContain('alice')
  })

  it('does not duplicate an already-typing user', () => {
    const { handleTypingUser, getUsers } = createTypingState()
    handleTypingUser('alice', 'active')
    handleTypingUser('alice', 'active')
    expect(getUsers().filter(u => u === 'alice')).toHaveLength(1)
  })

  it('removes user on done state', () => {
    const { handleTypingUser, getUsers } = createTypingState()
    handleTypingUser('alice', 'active')
    handleTypingUser('alice', 'done')
    expect(getUsers()).not.toContain('alice')
  })

  it('removes user on undefined state', () => {
    const { handleTypingUser, getUsers } = createTypingState()
    handleTypingUser('alice', 'active')
    handleTypingUser('alice', undefined)
    expect(getUsers()).not.toContain('alice')
  })

  it('removes user after 6s timeout', () => {
    const { handleTypingUser, getUsers } = createTypingState()
    handleTypingUser('alice', 'active')
    vi.advanceTimersByTime(TYPING_TIMEOUT)
    expect(getUsers()).not.toContain('alice')
  })

  it('resets the 6s timeout on repeated active signals', () => {
    const { handleTypingUser, getUsers } = createTypingState()
    handleTypingUser('alice', 'active')
    vi.advanceTimersByTime(5_000)
    handleTypingUser('alice', 'active') // reset timer
    vi.advanceTimersByTime(5_000)       // only 5s into new timer
    expect(getUsers()).toContain('alice')
    vi.advanceTimersByTime(1_001)       // now past the reset timer
    expect(getUsers()).not.toContain('alice')
  })

  it('removes only the done user, leaving others', () => {
    const { handleTypingUser, getUsers } = createTypingState()
    handleTypingUser('alice', 'active')
    handleTypingUser('bob', 'active')
    handleTypingUser('alice', 'done')
    expect(getUsers()).not.toContain('alice')
    expect(getUsers()).toContain('bob')
  })
})

describe('handlePmTyping — private messages', () => {
  it('adds peer on active state', () => {
    const { handlePmTyping, getPeers } = createPmTypingState()
    handlePmTyping('alice', 'active')
    expect(getPeers().has('alice')).toBe(true)
  })

  it('removes peer on done state', () => {
    const { handlePmTyping, getPeers } = createPmTypingState()
    handlePmTyping('alice', 'active')
    handlePmTyping('alice', 'done')
    expect(getPeers().has('alice')).toBe(false)
  })

  it('removes peer after 6s timeout', () => {
    const { handlePmTyping, getPeers } = createPmTypingState()
    handlePmTyping('alice', 'active')
    vi.advanceTimersByTime(TYPING_TIMEOUT)
    expect(getPeers().has('alice')).toBe(false)
  })

  it('resets timeout on paused state', () => {
    const { handlePmTyping, getPeers } = createPmTypingState()
    handlePmTyping('alice', 'active')
    vi.advanceTimersByTime(5_000)
    handlePmTyping('alice', 'paused')
    vi.advanceTimersByTime(5_000)
    expect(getPeers().has('alice')).toBe(true)
    vi.advanceTimersByTime(1_001)
    expect(getPeers().has('alice')).toBe(false)
  })
})
