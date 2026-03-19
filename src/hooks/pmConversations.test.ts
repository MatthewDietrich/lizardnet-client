import { describe, it, expect } from 'vitest'
import type { Message } from '../types'

// ── Pure helpers mirrored from usePmConversations ─────────────────────────────
// resolveKey and mapWithout are not exported, so we reproduce them here
// exactly as written in the source — same as the ircMessageOps pattern.

function resolveKey(map: Map<string, unknown>, peer: string): string {
  const lower = peer.toLowerCase()
  for (const key of map.keys()) {
    if (key.toLowerCase() === lower) return key
  }
  return peer
}

function mapWithout<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  if (!map.has(key)) return map
  const next = new Map(map)
  next.delete(key)
  return next
}

// ── Message transform helpers (mirror of setState updaters) ───────────────────

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: crypto.randomUUID(),
    from: 'alice',
    text: 'hello',
    ts: new Date(),
    kind: 'chat',
    ...overrides,
  }
}

// Mirrors the setPmConversations updater inside editPmMessage
function editPmMessage(
  prev: Map<string, Message[]>,
  peer: string,
  msgid: string,
  newText: string,
): Map<string, Message[]> {
  const key = resolveKey(prev, peer)
  const msgs = prev.get(key)
  if (!msgs) return prev
  const idx = msgs.reduce((found, m, i) => (m.msgid === msgid ? i : found), -1)
  if (idx === -1) return prev
  const next = new Map(prev)
  const updated = [...msgs]
  updated[idx] = {
    ...updated[idx],
    text: newText,
    edited: true,
    originalText: updated[idx].originalText ?? updated[idx].text,
  }
  next.set(key, updated)
  return next
}

// Mirrors the setPmConversations updater inside handlePeerRename (conversations side)
function renamePeerInConversations(
  prev: Map<string, Message[]>,
  oldNick: string,
  newNick: string,
): Map<string, Message[]> {
  if (!prev.has(oldNick)) return prev
  const next = new Map(prev)
  next.set(newNick, next.get(oldNick)!)
  next.delete(oldNick)
  return next
}

// Mirrors the setPmUnread updater inside handlePeerRename (unread side)
function renamePeerInUnread(
  prev: Map<string, number>,
  oldNick: string,
  newNick: string,
): Map<string, number> {
  if (!prev.has(oldNick)) return prev
  const next = new Map(prev)
  next.set(newNick, next.get(oldNick)!)
  next.delete(oldNick)
  return next
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveKey', () => {
  it('returns the existing key when case matches exactly', () => {
    const map = new Map([['Alice', []]])
    expect(resolveKey(map, 'Alice')).toBe('Alice')
  })

  it('returns the existing key when peer differs in case', () => {
    const map = new Map([['Alice', []]])
    expect(resolveKey(map, 'alice')).toBe('Alice')
  })

  it('returns the existing key when peer is uppercased', () => {
    const map = new Map([['alice', []]])
    expect(resolveKey(map, 'ALICE')).toBe('alice')
  })

  it('returns the peer itself when no key matches', () => {
    const map = new Map([['bob', []]])
    expect(resolveKey(map, 'alice')).toBe('alice')
  })

  it('returns peer itself for an empty map', () => {
    const map = new Map<string, unknown>()
    expect(resolveKey(map, 'alice')).toBe('alice')
  })
})

describe('mapWithout', () => {
  it('returns the same map reference when key is absent', () => {
    const map = new Map([['a', 1]])
    const result = mapWithout(map, 'b')
    expect(result).toBe(map)
  })

  it('returns a new map without the key when key is present', () => {
    const map = new Map([['a', 1], ['b', 2]])
    const result = mapWithout(map, 'a')
    expect(result).not.toBe(map)
    expect(result.has('a')).toBe(false)
    expect(result.get('b')).toBe(2)
  })

  it('does not mutate the original map', () => {
    const map = new Map([['a', 1], ['b', 2]])
    mapWithout(map, 'a')
    expect(map.has('a')).toBe(true)
  })

  it('returns an empty map when the last key is removed', () => {
    const map = new Map([['only', 99]])
    const result = mapWithout(map, 'only')
    expect(result.size).toBe(0)
  })
})

describe('editPmMessage', () => {
  it('updates text and sets edited flag', () => {
    const msgs = [makeMsg({ msgid: 'abc', text: 'old' })]
    const prev = new Map([['Alice', msgs]])
    const next = editPmMessage(prev, 'Alice', 'abc', 'new text')
    expect(next.get('Alice')![0].text).toBe('new text')
    expect(next.get('Alice')![0].edited).toBe(true)
  })

  it('captures originalText on first edit', () => {
    const msgs = [makeMsg({ msgid: 'abc', text: 'original' })]
    const prev = new Map([['Alice', msgs]])
    const next = editPmMessage(prev, 'Alice', 'abc', 'updated')
    expect(next.get('Alice')![0].originalText).toBe('original')
  })

  it('preserves originalText from first edit on subsequent edits', () => {
    const msgs = [makeMsg({ msgid: 'abc', text: 'second', edited: true, originalText: 'first' })]
    const prev = new Map([['Alice', msgs]])
    const next = editPmMessage(prev, 'Alice', 'abc', 'third')
    expect(next.get('Alice')![0].originalText).toBe('first')
  })

  it('returns prev unchanged when msgid not found', () => {
    const msgs = [makeMsg({ msgid: 'abc' })]
    const prev = new Map([['Alice', msgs]])
    const next = editPmMessage(prev, 'Alice', 'xyz', 'new text')
    expect(next).toBe(prev)
  })

  it('returns prev unchanged when peer not found', () => {
    const prev = new Map<string, Message[]>([['Alice', []]])
    const next = editPmMessage(prev, 'Bob', 'abc', 'new text')
    expect(next).toBe(prev)
  })

  it('resolves peer case-insensitively', () => {
    const msgs = [makeMsg({ msgid: 'abc', text: 'old' })]
    const prev = new Map([['Alice', msgs]])
    const next = editPmMessage(prev, 'alice', 'abc', 'new text')
    expect(next.get('Alice')![0].text).toBe('new text')
  })
})

describe('renamePeerInConversations', () => {
  it('moves messages from old nick to new nick', () => {
    const msgs = [makeMsg()]
    const prev = new Map([['Alice', msgs]])
    const next = renamePeerInConversations(prev, 'Alice', 'Alice_')
    expect(next.has('Alice')).toBe(false)
    expect(next.get('Alice_')).toBe(msgs)
  })

  it('returns same map when old nick is not present', () => {
    const prev = new Map([['Bob', [makeMsg()]]])
    const next = renamePeerInConversations(prev, 'Alice', 'Alice_')
    expect(next).toBe(prev)
  })

  it('does not mutate the original map', () => {
    const prev = new Map([['Alice', [makeMsg()]]])
    renamePeerInConversations(prev, 'Alice', 'Alice_')
    expect(prev.has('Alice')).toBe(true)
  })

  it('preserves other peers in the map', () => {
    const aliceMsgs = [makeMsg()]
    const bobMsgs   = [makeMsg({ from: 'bob' })]
    const prev = new Map([['Alice', aliceMsgs], ['Bob', bobMsgs]])
    const next = renamePeerInConversations(prev, 'Alice', 'Alice_')
    expect(next.get('Bob')).toBe(bobMsgs)
  })
})

describe('renamePeerInUnread', () => {
  it('moves unread count from old nick to new nick', () => {
    const prev = new Map([['Alice', 3]])
    const next = renamePeerInUnread(prev, 'Alice', 'Alice_')
    expect(next.has('Alice')).toBe(false)
    expect(next.get('Alice_')).toBe(3)
  })

  it('returns same map when old nick is not present', () => {
    const prev = new Map([['Bob', 2]])
    const next = renamePeerInUnread(prev, 'Alice', 'Alice_')
    expect(next).toBe(prev)
  })

  it('preserves unread counts for other peers', () => {
    const prev = new Map([['Alice', 5], ['Bob', 1]])
    const next = renamePeerInUnread(prev, 'Alice', 'Alice_')
    expect(next.get('Bob')).toBe(1)
  })
})
