import { describe, it, expect } from 'vitest'
import type { Message } from '../types'

// ── Pure transforms extracted from useIrcMessages ────────────────────────────
// These mirror the `prev => ...` updater functions in the hook exactly.

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

function editMessageByMsgid(prev: Message[], msgid: string, newText: string): Message[] {
  const idx = prev.reduce((found, m, i) => (m.msgid === msgid ? i : found), -1)
  if (idx === -1) return prev
  const next = [...prev]
  next[idx] = { ...next[idx], text: newText, edited: true, originalText: next[idx].originalText ?? next[idx].text }
  return next
}

function deleteMessageByMsgid(prev: Message[], msgid: string): Message[] {
  return prev.map(m => (m.msgid === msgid ? { ...m, text: '[message deleted]', deleted: true } : m))
}

function injectChannelMsgid(prev: Message[], fromNick: string, text: string, msgid: string): Message[] {
  for (let i = prev.length - 1; i >= 0; i--) {
    if (prev[i].from === fromNick && prev[i].text === text && !prev[i].msgid) {
      const next = [...prev]
      next[i] = { ...next[i], msgid }
      return next
    }
  }
  return prev
}

function redactChannelUrl(prev: Message[], url: string, replace: (t: string) => string): Message[] {
  return prev.map(m => (m.text.includes(url) ? { ...m, text: replace(m.text) } : m))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('editMessageByMsgid', () => {
  it('updates text and sets edited flag', () => {
    const msgs = [makeMsg({ msgid: 'abc', text: 'old' })]
    const result = editMessageByMsgid(msgs, 'abc', 'new')
    expect(result[0].text).toBe('new')
    expect(result[0].edited).toBe(true)
    expect(result[0].originalText).toBe('old')
  })

  it('preserves originalText from first edit on subsequent edits', () => {
    const msgs = [makeMsg({ msgid: 'abc', text: 'second', edited: true, originalText: 'first' })]
    const result = editMessageByMsgid(msgs, 'abc', 'third')
    expect(result[0].originalText).toBe('first')
  })

  it('returns prev unchanged when msgid not found', () => {
    const msgs = [makeMsg({ msgid: 'abc' })]
    const result = editMessageByMsgid(msgs, 'xyz', 'new')
    expect(result).toBe(msgs)
  })

  it('edits the correct message when multiple exist', () => {
    const msgs = [makeMsg({ msgid: 'a', text: 'first' }), makeMsg({ msgid: 'b', text: 'second' })]
    const result = editMessageByMsgid(msgs, 'b', 'updated')
    expect(result[0].text).toBe('first')
    expect(result[1].text).toBe('updated')
  })
})

describe('deleteMessageByMsgid', () => {
  it('marks message as deleted with tombstone text', () => {
    const msgs = [makeMsg({ msgid: 'abc', text: 'bye' })]
    const result = deleteMessageByMsgid(msgs, 'abc')
    expect(result[0].text).toBe('[message deleted]')
    expect(result[0].deleted).toBe(true)
  })

  it('leaves other messages untouched', () => {
    const msgs = [makeMsg({ msgid: 'a' }), makeMsg({ msgid: 'b', text: 'keep' })]
    const result = deleteMessageByMsgid(msgs, 'a')
    expect(result[1].text).toBe('keep')
    expect(result[1].deleted).toBeUndefined()
  })

  it('is a no-op when msgid not found', () => {
    const msgs = [makeMsg({ msgid: 'abc' })]
    const result = deleteMessageByMsgid(msgs, 'xyz')
    expect(result[0].deleted).toBeUndefined()
  })
})

describe('injectChannelMsgid', () => {
  it('injects msgid into the most recent matching unsent message', () => {
    const msgs = [
      makeMsg({ from: 'me', text: 'hi', msgid: undefined }),
    ]
    const result = injectChannelMsgid(msgs, 'me', 'hi', 'abc')
    expect(result[0].msgid).toBe('abc')
  })

  it('skips messages that already have a msgid', () => {
    const msgs = [
      makeMsg({ from: 'me', text: 'hi', msgid: 'existing' }),
    ]
    const result = injectChannelMsgid(msgs, 'me', 'hi', 'new')
    expect(result[0].msgid).toBe('existing')
  })

  it('matches the most recent when duplicates exist', () => {
    const msgs = [
      makeMsg({ id: '1', from: 'me', text: 'hi', msgid: undefined }),
      makeMsg({ id: '2', from: 'me', text: 'hi', msgid: undefined }),
    ]
    const result = injectChannelMsgid(msgs, 'me', 'hi', 'injected')
    expect(result[1].msgid).toBe('injected')
    expect(result[0].msgid).toBeUndefined()
  })

  it('returns prev unchanged when no match', () => {
    const msgs = [makeMsg({ from: 'me', text: 'bye' })]
    const result = injectChannelMsgid(msgs, 'me', 'hi', 'abc')
    expect(result).toBe(msgs)
  })
})

describe('redactChannelUrl', () => {
  it('replaces url in matching messages', () => {
    const url = 'https://example.com/file.jpg'
    const msgs = [makeMsg({ text: `look: ${url}` })]
    const result = redactChannelUrl(msgs, url, t => t.replace(url, '[media deleted]'))
    expect(result[0].text).toBe('look: [media deleted]')
  })

  it('leaves non-matching messages untouched', () => {
    const msgs = [makeMsg({ text: 'no url here' })]
    const result = redactChannelUrl(msgs, 'https://example.com/x.jpg', t => t)
    expect(result[0]).toBe(msgs[0])
  })
})
