import { describe, it, expect, vi } from 'vitest'

// ── Simulated environment mirroring useIrcModeration internals ────────────────
// The hook has no React state — every function closes over refs and calls
// clientRef.current.raw(). We replicate that environment here so we can drive
// the logic without React or renderHook.

function createModerationEnv() {
  const mockClient = { raw: vi.fn(), say: vi.fn() }
  const clientRef = { current: mockClient }

  const pendingBansRef = { current: new Set<string>() }
  const silentWhoisRef = { current: new Set<string>() }
  const maskToNickRef  = { current: new Map<string, string>() }

  function sanitize(s: string) { return s.replace(/[\r\n]/g, '') }

  function handleWhoisForBan(e: { nick: string; ident?: string; hostname?: string }): boolean {
    if (!e.nick || !pendingBansRef.current.has(e.nick)) return false
    const mask = `*!${e.ident ?? '*'}@${e.hostname ?? '*'}`
    pendingBansRef.current.delete(e.nick)
    maskToNickRef.current.set(mask, e.nick)
    clientRef.current?.raw(`MODE #chat +b ${mask}`)
    clientRef.current?.raw(`KICK #chat ${e.nick}`)
    return true
  }

  function kick(target: string) { clientRef.current?.raw(`KICK #chat ${sanitize(target)}`) }

  function ban(target: string) {
    const safe = sanitize(target)
    pendingBansRef.current.add(safe)
    silentWhoisRef.current.add(safe)
    clientRef.current?.raw(`WHOIS ${safe}`)
  }

  function unban(mask: string) { clientRef.current?.raw(`MODE #chat -b ${sanitize(mask)}`) }
  function op(target: string)  { clientRef.current?.raw(`MODE #chat +o ${sanitize(target)}`) }
  function deop(target: string){ clientRef.current?.raw(`MODE #chat -o ${sanitize(target)}`) }

  return {
    mockClient,
    pendingBansRef, silentWhoisRef, maskToNickRef,
    handleWhoisForBan, kick, ban, unban, op, deop,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('kick', () => {
  it('sends KICK #chat <target>', () => {
    const { kick, mockClient } = createModerationEnv()
    kick('badguy')
    expect(mockClient.raw).toHaveBeenCalledWith('KICK #chat badguy')
  })

  it('strips newlines from the target', () => {
    const { kick, mockClient } = createModerationEnv()
    kick('bad\nguy')
    expect(mockClient.raw).toHaveBeenCalledWith('KICK #chat badguy')
  })

  it('strips carriage returns from the target', () => {
    const { kick, mockClient } = createModerationEnv()
    kick('bad\rguy')
    expect(mockClient.raw).toHaveBeenCalledWith('KICK #chat badguy')
  })
})

describe('ban', () => {
  it('adds the target to pendingBansRef and silentWhoisRef', () => {
    const { ban, pendingBansRef, silentWhoisRef } = createModerationEnv()
    ban('spammer')
    expect(pendingBansRef.current.has('spammer')).toBe(true)
    expect(silentWhoisRef.current.has('spammer')).toBe(true)
  })

  it('sends WHOIS <target>', () => {
    const { ban, mockClient } = createModerationEnv()
    ban('spammer')
    expect(mockClient.raw).toHaveBeenCalledWith('WHOIS spammer')
  })

  it('sanitizes the target before adding to pending sets and sending', () => {
    const { ban, pendingBansRef, mockClient } = createModerationEnv()
    ban('spam\nmer')
    expect(pendingBansRef.current.has('spammer')).toBe(true)
    expect(mockClient.raw).toHaveBeenCalledWith('WHOIS spammer')
  })
})

describe('unban', () => {
  it('sends MODE #chat -b <mask>', () => {
    const { unban, mockClient } = createModerationEnv()
    unban('*!bad@*.example.com')
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat -b *!bad@*.example.com')
  })

  it('strips newlines from the mask', () => {
    const { unban, mockClient } = createModerationEnv()
    unban('*!bad@host\n.com')
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat -b *!bad@host.com')
  })
})

describe('op', () => {
  it('sends MODE #chat +o <target>', () => {
    const { op, mockClient } = createModerationEnv()
    op('alice')
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat +o alice')
  })

  it('strips newlines from the target', () => {
    const { op, mockClient } = createModerationEnv()
    op('ali\nce')
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat +o alice')
  })
})

describe('deop', () => {
  it('sends MODE #chat -o <target>', () => {
    const { deop, mockClient } = createModerationEnv()
    deop('alice')
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat -o alice')
  })

  it('strips newlines from the target', () => {
    const { deop, mockClient } = createModerationEnv()
    deop('ali\nce')
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat -o alice')
  })
})

describe('handleWhoisForBan', () => {
  it('returns false when nick is not pending a ban', () => {
    const { handleWhoisForBan } = createModerationEnv()
    const result = handleWhoisForBan({ nick: 'innocent', ident: 'i', hostname: 'host.net' })
    expect(result).toBe(false)
  })

  it('returns true when a ban is pending for the nick', () => {
    const { ban, handleWhoisForBan } = createModerationEnv()
    ban('spammer')
    const result = handleWhoisForBan({ nick: 'spammer', ident: 'sp', hostname: 'evil.net' })
    expect(result).toBe(true)
  })

  it('sends MODE +b with ident and hostname', () => {
    const { ban, handleWhoisForBan, mockClient } = createModerationEnv()
    ban('spammer')
    mockClient.raw.mockClear()
    handleWhoisForBan({ nick: 'spammer', ident: 'sp', hostname: 'evil.net' })
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat +b *!sp@evil.net')
  })

  it('sends KICK #chat <nick>', () => {
    const { ban, handleWhoisForBan, mockClient } = createModerationEnv()
    ban('spammer')
    mockClient.raw.mockClear()
    handleWhoisForBan({ nick: 'spammer', ident: 'sp', hostname: 'evil.net' })
    expect(mockClient.raw).toHaveBeenCalledWith('KICK #chat spammer')
  })

  it('uses wildcard for missing ident', () => {
    const { ban, handleWhoisForBan, mockClient } = createModerationEnv()
    ban('spammer')
    mockClient.raw.mockClear()
    handleWhoisForBan({ nick: 'spammer', hostname: 'evil.net' })
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat +b *!*@evil.net')
  })

  it('uses wildcard for missing hostname', () => {
    const { ban, handleWhoisForBan, mockClient } = createModerationEnv()
    ban('spammer')
    mockClient.raw.mockClear()
    handleWhoisForBan({ nick: 'spammer', ident: 'sp' })
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat +b *!sp@*')
  })

  it('uses wildcards for both missing ident and hostname', () => {
    const { ban, handleWhoisForBan, mockClient } = createModerationEnv()
    ban('spammer')
    mockClient.raw.mockClear()
    handleWhoisForBan({ nick: 'spammer' })
    expect(mockClient.raw).toHaveBeenCalledWith('MODE #chat +b *!*@*')
  })

  it('removes nick from pendingBansRef after handling', () => {
    const { ban, handleWhoisForBan, pendingBansRef } = createModerationEnv()
    ban('spammer')
    handleWhoisForBan({ nick: 'spammer', ident: 'sp', hostname: 'evil.net' })
    expect(pendingBansRef.current.has('spammer')).toBe(false)
  })

  it('stores the mask-to-nick mapping', () => {
    const { ban, handleWhoisForBan, maskToNickRef } = createModerationEnv()
    ban('spammer')
    handleWhoisForBan({ nick: 'spammer', ident: 'sp', hostname: 'evil.net' })
    expect(maskToNickRef.current.get('*!sp@evil.net')).toBe('spammer')
  })

  it('does not fire for a second whois when no ban is pending', () => {
    const { ban, handleWhoisForBan, mockClient } = createModerationEnv()
    ban('spammer')
    handleWhoisForBan({ nick: 'spammer', ident: 'sp', hostname: 'evil.net' })
    mockClient.raw.mockClear()
    const second = handleWhoisForBan({ nick: 'spammer', ident: 'sp', hostname: 'evil.net' })
    expect(second).toBe(false)
    expect(mockClient.raw).not.toHaveBeenCalled()
  })
})
