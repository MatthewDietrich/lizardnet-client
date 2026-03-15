import { useState, useRef, useEffect } from 'react'
import IRC from 'irc-framework'
import type { Message } from '../types'
import type { Settings } from './useSettings'
import { playNotificationSound } from '../lib/notification'
import { encryptCreds, decryptCreds } from '../lib/credentials'
import { useReconnect } from './useReconnect'
import { usePmConversations } from './usePmConversations'

export type { ConnStatus } from './useReconnect'

const HOST = 'irc.lizard.fun'
const PORT = 7003
const RATE_LIMIT = { messages: 5, windowMs: 4000 }
const MAX_MESSAGES = 2000
const BOT_NICK = 'MediaBot'

export function useIrcClient(settings: Settings) {
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const [nick, setNick] = useState('')
  const nickRef = useRef('')
  const [connected, setConnected] = useState(false)
  const [isOper, setIsOper] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [ops, setOps] = useState<string[]>([])
  const opsRef = useRef<string[]>([])
  useEffect(() => { opsRef.current = ops }, [ops])
  const [bannedUsers, setBannedUsers] = useState<string[]>([])
  const [topic, setTopicState] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [awayUsers, setAwayUsers] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [pmTypingPeers, setPmTypingPeers] = useState<Set<string>>(new Set())
  const pmTypingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const focusedRef = useRef(document.hasFocus())
  const clientRef = useRef<InstanceType<typeof IRC.Client> | null>(null)
  const botRequestsRef = useRef<{ resolve: (msg: string) => void; reject: (e: Error) => void }[]>([])
  const botBufferRef = useRef('')
  const credentialsRef = useRef<Awaited<ReturnType<typeof encryptCreds>> | null>(null)
  const sendTimestampsRef = useRef<number[]>([])
  const activeBatchesRef = useRef<Map<string, string>>(new Map())
  const pendingBansRef = useRef<Set<string>>(new Set())
  const silentWhoisRef = useRef<Set<string>>(new Set())
  const maskToNickRef = useRef<Map<string, string>>(new Map())

  function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
  function sanitize(s: string) { return s.replace(/[\r\n]/g, '') }

  const { connStatus, setConnStatus, connStatusRef, manualDisconnectRef, schedule, cancel: cancelReconnect, resetDelay } = useReconnect()

  const {
    pmConversations, pmUnread, pmPeerRename,
    setActivePmPeer, addPmMessage, addActiveEvent,
    openPmConversation, closePmConversation, clearPmUnread, clearActivePeerUnread,
    handlePeerRename, redactInPmConversations,
  } = usePmConversations({ focusedRef, settingsRef, onChannelUnread: () => setUnreadCount(n => n + 1) })

  useEffect(() => {
    function onFocus() {
      focusedRef.current = true
      setUnreadCount(0)
      clearActivePeerUnread()
    }
    function onBlur() { focusedRef.current = false }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onBlur) }
  }, [])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) return
      const creds = credentialsRef.current
      if (!creds || connStatusRef.current !== 'reconnecting') return
      cancelReconnect()
      resetDelay()
      decryptCreds(creds).then(pw => connectCore(creds.nick, pw, true))
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  function handleTypingUser(who: string, state: string | undefined) {
    const timers = typingTimersRef.current
    clearTimeout(timers.get(who))
    timers.delete(who)
    if (!state || state === 'done') {
      setTypingUsers(prev => prev.filter(u => u !== who))
      return
    }
    setTypingUsers(prev => prev.includes(who) ? prev : [...prev, who])
    timers.set(who, setTimeout(() => {
      timers.delete(who)
      setTypingUsers(prev => prev.filter(u => u !== who))
    }, 6_000))
  }

  function handlePmTyping(who: string, state: string | undefined) {
    const timers = pmTypingTimersRef.current
    clearTimeout(timers.get(who))
    timers.delete(who)
    if (!state || state === 'done') {
      setPmTypingPeers(prev => { const s = new Set(prev); s.delete(who); return s })
      return
    }
    setPmTypingPeers(prev => new Set([...prev, who]))
    timers.set(who, setTimeout(() => {
      timers.delete(who)
      setPmTypingPeers(prev => { const s = new Set(prev); s.delete(who); return s })
    }, 6_000))
  }

  function clearAllTyping() {
    for (const t of typingTimersRef.current.values()) clearTimeout(t)
    typingTimersRef.current.clear()
    setTypingUsers([])
    for (const t of pmTypingTimersRef.current.values()) clearTimeout(t)
    pmTypingTimersRef.current.clear()
    setPmTypingPeers(new Set())
  }

  function addMessage(from: string, text: string, kind: 'chat' | 'event' | 'pm' | 'action' = 'chat', ts?: Date, isHistory = false) {
    const isMention = !isHistory && (kind === 'chat' || kind === 'action') &&
      !!nickRef.current &&
      from !== nickRef.current &&
      new RegExp(`\\b${escapeRegex(nickRef.current)}\\b`, 'i').test(text)
    if (isMention) {
      if (settingsRef.current.soundMentions) playNotificationSound(settingsRef.current.mentionSound)
      if (!focusedRef.current) {
        setUnreadCount(n => n + 1)
        if (settingsRef.current.desktopNotifications && Notification.permission === 'granted') {
          new Notification(`${from} mentioned you`, { body: text, silent: true })
        }
      }
    }
    setMessages(prev => {
      const next = [...prev, { from, text, ts: ts ?? new Date(), kind }]
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
    })
  }

  function addActive(text: string) {
    addActiveEvent(text, () => addMessage('*', text, 'event'))
  }

  function attachListeners(client: InstanceType<typeof IRC.Client>) {
    client.on('message', (event: unknown) => {
      const { nick: who, target, message, type, tags } = event as { nick: string; target: string; message: string; type: string; tags?: Record<string, string> }
      if (!who || who === '*' || who.includes('.') || who.toLowerCase() === 'nickserv') return
      if (who.toLowerCase() === BOT_NICK.toLowerCase()) {
        if (target?.toLowerCase() === '#chat') {
          const trimmed = message.trim()
          if (trimmed.startsWith('MEDIADELETE ')) {
            const url = trimmed.slice('MEDIADELETE '.length).trim()
            if (url) redactMediaUrl(url)
          }
        }
        return
      }
      const isAction = type === 'action'
      const serverTime = tags?.['server-time'] ? new Date(tags['server-time']) : undefined
      const isHistory = !!(tags?.batch && activeBatchesRef.current.get(tags.batch) === 'chathistory')
      if (target?.toLowerCase() === '#chat') {
        addMessage(who, message, isAction ? 'action' : 'chat', serverTime, isHistory)
      } else {
        addPmMessage(who, who, message, true, isAction ? 'action' : 'chat')
      }
    })

    client.on('raw', (event: unknown) => {
      const e = event as { line?: string; from_server?: boolean }
      if (!e.from_server || !e.line) return

      let rest = e.line
      if (rest.startsWith('@')) rest = rest.slice(rest.indexOf(' ') + 1)
      if (rest.startsWith(':')) rest = rest.slice(rest.indexOf(' ') + 1)
      const spaceIdx = rest.indexOf(' ')
      const cmd = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
      const paramStr = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1)
      const parts = paramStr.split(' ')
      const p: string[] = []
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].startsWith(':')) { p.push(parts.slice(i).join(' ').slice(1)); break }
        if (parts[i]) p.push(parts[i])
      }

      if (cmd === '332' && p[1]?.toLowerCase() === '#chat' && p[2]) setTopicState(p[2])
      if (cmd === 'TOPIC' && p[0]?.toLowerCase() === '#chat' && p[1] !== undefined) {
        setTopicState(p[1])
        addMessage('*', `Topic changed to: ${p[1]}`, 'event')
      }
      if (cmd === '305') {
        addActive('You are no longer marked as away.')
        setAwayUsers(prev => { const s = new Set(prev); s.delete(nickRef.current); return s })
      }
      if (cmd === '306') {
        addActive('You have been marked as away.')
        setAwayUsers(prev => new Set([...prev, nickRef.current]))
      }
      if (cmd === '381') { setIsOper(true); client.raw('MODE #chat +b'); addActive('You are now a server operator.') }
      if (cmd === '464') { addActive('OPER failed: incorrect password.') }
      if (cmd === '491') { addActive('OPER failed: no O-lines for your host.') }
      if (cmd === '311' && p[1] && pendingBansRef.current.has(p[1])) {
        const mask = `*!${p[2]}@${p[3]}`
        pendingBansRef.current.delete(p[1])
        maskToNickRef.current.set(mask, p[1])
        clientRef.current?.raw(`MODE #chat +b ${mask}`)
        clientRef.current?.raw(`KICK #chat ${p[1]}`)
      }
      if (cmd === '474' || cmd === '465') addActive('You have been banned.')
      if (cmd === '367' && p[1]?.toLowerCase() === '#chat' && p[2]) {
        setBannedUsers(prev => prev.includes(p[2]) ? prev : [...prev, p[2]])
      }
      if (cmd === 'BATCH') {
        const ref = p[0]
        if (ref?.startsWith('+')) {
          activeBatchesRef.current.set(ref.slice(1), p[1] ?? '')
        } else if (ref?.startsWith('-')) {
          const type = activeBatchesRef.current.get(ref.slice(1))
          activeBatchesRef.current.delete(ref.slice(1))
          if (type === 'chathistory') addMessage('*', '─── history above ───', 'event')
        }
      }
    })

    client.on('whois', (e) => {
      if (silentWhoisRef.current.has(e.nick)) { silentWhoisRef.current.delete(e.nick); return }
      const lines: string[] = []
      if (e.idle !== undefined) lines.push(`${e.nick} has been idle ${e.idle}s`)
      if (e.operator) lines.push(`  ${e.nick} is a server admin`)
      for (const line of lines) addMessage('*', line, 'event')
    })

    client.on('mode', (event: unknown) => {
      const e = event as { target?: string; modes?: Array<{ mode: string; param?: string }> }
      if (e.target === nickRef.current && e.modes?.some(m => m.mode === '+o')) setIsOper(true)
      if (e.target?.toLowerCase() === '#chat') {
        for (const m of e.modes ?? []) {
          if (m.mode === '+o' && m.param) {
            setOps(prev => prev.includes(m.param!) ? prev : [...prev, m.param!])
            if (m.param === nickRef.current) setIsOper(true)
            addMessage('*', `${m.param} is now a moderator`, 'event')
          }
          if (m.mode === '-o' && m.param) {
            setOps(prev => prev.filter(u => u !== m.param))
            if (m.param === nickRef.current) setIsOper(false)
            addMessage('*', `${m.param} is no longer a moderator`, 'event')
          }
          if (m.mode === '+b' && m.param) {
            setBannedUsers(prev => prev.includes(m.param!) ? prev : [...prev, m.param!])
            addMessage('*', `${maskToNickRef.current.get(m.param!) ?? m.param!} has been banned`, 'event')
          }
          if (m.mode === '-b' && m.param) {
            setBannedUsers(prev => prev.filter(u => u !== m.param))
            addMessage('*', `${maskToNickRef.current.get(m.param!) ?? m.param!} has been unbanned`, 'event')
            maskToNickRef.current.delete(m.param!)
          }
        }
      }
    })

    client.on('away', (event: unknown) => {
      const e = event as { nick: string }
      setAwayUsers(prev => new Set([...prev, e.nick]))
    })
    client.on('back', (event: unknown) => {
      const e = event as { nick: string }
      setAwayUsers(prev => { const s = new Set(prev); s.delete(e.nick); return s })
    })

    client.on('join', ({ nick: who, channel }) => {
      if (who === nickRef.current) return
      if (channel.toLowerCase() !== '#chat') return
      if (who.toLowerCase() === 'chanserv') return
      setUsers(prev => prev.includes(who) ? prev : [...prev, who].sort((a, b) => a.localeCompare(b)))
      addMessage('*', `${who} has joined`, 'event')
    })

    client.on('kick', ({ kicked, nick: by, channel }) => {
      if (channel.toLowerCase() !== '#chat') return
      setUsers(prev => prev.filter(u => u !== kicked))
      addMessage('*', `${kicked} was kicked by ${by}`, 'event')
    })

    client.on('part', (event: unknown) => {
      const e = event as { nick: string; channel: string; message?: string }
      if (e.channel.toLowerCase() !== '#chat') return
      setUsers(prev => prev.filter(u => u !== e.nick))
      setAwayUsers(prev => { const s = new Set(prev); s.delete(e.nick); return s })
      handleTypingUser(e.nick, 'done')
      handlePmTyping(e.nick, 'done')
      addMessage('*', `${e.nick} has left${e.message ? ` (${e.message})` : ''}`, 'event')
    })

    client.on('quit', (event: unknown) => {
      const e = event as { nick: string; message?: string }
      setUsers(prev => prev.filter(u => u !== e.nick))
      setAwayUsers(prev => { const s = new Set(prev); s.delete(e.nick); return s })
      handleTypingUser(e.nick, 'done')
      handlePmTyping(e.nick, 'done')
      addMessage('*', `${e.nick} has quit`, 'event')
    })

    client.on('userlist', (event: unknown) => {
      const e = event as { channel: string; users: Array<{ nick: string; modes: string[] }> }
      if (e.channel.toLowerCase() !== '#chat') return
      setUsers(e.users.map(u => u.nick).filter(n => n.toLowerCase() !== 'chanserv').sort((a, b) => a.localeCompare(b)))
      setOps(e.users.filter(u => u.modes.includes('o')).map(u => u.nick))
      const self = e.users.find(u => u.nick === nickRef.current)
      if (self?.modes.includes('o')) setIsOper(true)
    })

    client.on('nick', (event: unknown) => {
      const e = event as { nick: string; new_nick: string }
      if (e.nick === nickRef.current) { setNick(e.new_nick); nickRef.current = e.new_nick }
      handleTypingUser(e.nick, 'done')
      handlePmTyping(e.nick, 'done')
      setUsers(prev => prev.map(u => u === e.nick ? e.new_nick : u).sort((a, b) => a.localeCompare(b)))
      setOps(prev => prev.map(u => u === e.nick ? e.new_nick : u))
      setAwayUsers(prev => {
        if (!prev.has(e.nick)) return prev
        const s = new Set(prev); s.delete(e.nick); s.add(e.new_nick); return s
      })
      handlePeerRename(e.nick, e.new_nick)
      addMessage('*', `${e.nick} is now known as ${e.new_nick}`, 'event')
    })

    client.on('notice', (event: unknown) => {
      const e = event as { nick?: string; message?: string; notice?: string }
      let text = e.message ?? e.notice ?? ''
      if (!text) return
      if (e.nick?.toLowerCase() === BOT_NICK.toLowerCase()) {
        botBufferRef.current += text
        const buf = botBufferRef.current
        // PRESIGN_OK is complete when it ends with the public S3 URL (no trailing content)
        const isPresignOk = buf.startsWith('PRESIGN_OK ') && /https:\/\/lizardnet-media\.s3\.amazonaws\.com\/[0-9a-f-]+\.\w+$/.test(buf)
        const isComplete = isPresignOk || buf === 'DELETE_OK' || /^(PRESIGN_FAIL|DELETE_FAIL)/.test(buf)
        if (!isComplete) return
        botBufferRef.current = ''
        const pending = botRequestsRef.current.shift()
        if (pending) {
          if (isPresignOk || buf === 'DELETE_OK') {
            pending.resolve(buf)
          } else {
            pending.reject(new Error(buf.replace(/^(PRESIGN_FAIL|DELETE_FAIL)\s*/, '')))
          }
        }
        return
      }
      if (e.nick?.toLowerCase() === 'nickserv') {
        if (/^Last login from:/i.test(text)) return
        if (/^Welcome to /i.test(text)) return
        text = text.replace(/\/msg NickServ IDENTIFY(?:\s+\S+)?\s+(\S+)/gi, '/identify $1')
        addMessage('NickServ', text, 'event')
      }
    })

    client.on('close', () => {
      if (clientRef.current !== client) return
      clientRef.current = null
      setConnected(false)
      setIsOper(false)
      setUsers([])
      setOps([])
      setBannedUsers([])
      setAwayUsers(new Set())
      clearAllTyping()
      if (manualDisconnectRef.current) {
        manualDisconnectRef.current = false
        setConnStatus('disconnected')
        addMessage('*', 'Disconnected.', 'event')
        return
      }
      const delay = schedule(() => {
        const enc = credentialsRef.current
        if (enc) decryptCreds(enc).then(pw => connectCore(enc.nick, pw, true))
      })
      setConnStatus('reconnecting')
      addMessage('*', `Disconnected. Reconnecting in ${delay / 1000}s…`, 'event')
    })

    client.on('tagmsg', (event: unknown) => {
      const e = event as { nick?: string; target?: string; tags?: Record<string, string> }
      if (!e.nick || e.nick === nickRef.current) return
      const target = e.target?.toLowerCase()
      if (target === '#chat') handleTypingUser(e.nick, e.tags?.['+typing'])
      else if (target === nickRef.current.toLowerCase()) handlePmTyping(e.nick, e.tags?.['+typing'])
    })

    client.on('error', (err) => { addMessage('!', err.message) })
  }

  function connectCore(chosenNick: string, password: string, isReconnect: boolean, nickServCommand?: string) {
    cancelReconnect()
    const client = new IRC.Client()
    client.connect({ host: HOST, port: PORT, nick: chosenNick, tls: true })
    client.on('registered', () => {
      setConnected(true)
      setConnStatus('connected')
      resetDelay()
      if (isReconnect) {
        addMessage('*', 'Reconnected.', 'event')
      } else {
        addMessage('*', 'Connected')
        addMessage('*', `You are now logged in as ${chosenNick}`)
      }
      const cmd = nickServCommand ?? (password ? `IDENTIFY ${password}` : null)
      if (cmd) client.say('NickServ', cmd)
      client.join('#chat')
    })
    attachListeners(client)
    clientRef.current = client
  }

  async function connect(chosenNick: string, password: string) {
    clientRef.current?.quit('Reconnecting')
    clientRef.current = null
    manualDisconnectRef.current = false
    const normalizedNick = chosenNick.replace(/ /g, '_')
    setNick(normalizedNick)
    nickRef.current = normalizedNick
    credentialsRef.current = await encryptCreds(normalizedNick, password)
    resetDelay()
    setConnStatus('connecting')
    connectCore(normalizedNick, password, false)
  }

  async function register(chosenNick: string, password: string, email: string) {
    setNick(chosenNick)
    nickRef.current = chosenNick
    credentialsRef.current = await encryptCreds(chosenNick, password)
    manualDisconnectRef.current = false
    resetDelay()
    setConnStatus('connecting')
    connectCore(chosenNick, password, false, `REGISTER ${password} ${email}`)
  }

  function disconnect() {
    manualDisconnectRef.current = true
    cancelReconnect()
    clientRef.current?.quit('Goodbye')
    clientRef.current = null
    setConnected(false)
    setConnStatus('disconnected')
    setIsOper(false)
    setUsers([])
    setOps([])
    setBannedUsers([])
    setAwayUsers(new Set())
    clearAllTyping()
    addMessage('*', 'Disconnected.', 'event')
  }

  function checkRateLimit(): boolean {
    const now = Date.now()
    sendTimestampsRef.current = sendTimestampsRef.current.filter(t => now - t < RATE_LIMIT.windowMs)
    if (sendTimestampsRef.current.length >= RATE_LIMIT.messages) {
      addActive(`Slow down — max ${RATE_LIMIT.messages} messages per ${RATE_LIMIT.windowMs / 1000}s.`)
      return false
    }
    sendTimestampsRef.current.push(now)
    return true
  }

  function sendMessage(text: string) {
    if (!text.trim() || !clientRef.current) return
    if (!checkRateLimit()) return
    clientRef.current.say('#chat', text)
    addMessage(nickRef.current, text)
  }

  function sendPrivMsg(target: string, text: string) {
    if (!text.trim() || !clientRef.current) return
    if (!checkRateLimit()) return
    clientRef.current.say(target, text)
    addPmMessage(target, nickRef.current, text, false)
  }

  function sendAction(text: string, target = '#chat') {
    if (!text.trim() || !clientRef.current) return
    clientRef.current.say(target, `\x01ACTION ${text}\x01`)
    if (target === '#chat') {
      addMessage(nickRef.current, text, 'action')
    } else {
      addPmMessage(target, nickRef.current, text, false, 'action')
    }
  }

  function redactMediaUrl(url: string) {
    const replace = (text: string) => text.replace(url, '[media deleted]')
    setMessages(prev => prev.map(m => m.text.includes(url) ? { ...m, text: replace(m.text) } : m))
    redactInPmConversations(url, replace)
  }

  function whois(target: string) { clientRef.current?.raw(`WHOIS ${sanitize(target)}`) }
  function kick(target: string) { clientRef.current?.raw(`KICK #chat ${sanitize(target)}`) }
  function ban(target: string) {
    const safe = sanitize(target)
    pendingBansRef.current.add(safe)
    silentWhoisRef.current.add(safe)
    clientRef.current?.raw(`WHOIS ${safe}`)
  }
  function unban(mask: string) { clientRef.current?.raw(`MODE #chat -b ${sanitize(mask)}`) }
  function op(target: string) { clientRef.current?.raw(`MODE #chat +o ${sanitize(target)}`) }
  function deop(target: string) { clientRef.current?.raw(`MODE #chat -o ${sanitize(target)}`) }
  function changeTopic(newTopic: string) { clientRef.current?.raw(`TOPIC #chat :${sanitize(newTopic)}`) }
  function changeNick(newNick: string) { clientRef.current?.raw(`NICK ${sanitize(newNick).replace(/ /g, '_')}`) }
  function sayNickServ(text: string) { clientRef.current?.say('NickServ', text) }
  function setAway(message: string) { clientRef.current?.raw(`AWAY :${sanitize(message)}`) }
  function setBack() { clientRef.current?.raw('AWAY') }
  function sendOper(name: string, password: string) { clientRef.current?.raw(`OPER ${sanitize(name)} ${sanitize(password)}`) }
  function sendMediaDelete(url: string) { clientRef.current?.raw(`PRIVMSG #chat :MEDIADELETE ${sanitize(url)}`) }
  function sendTyping(state: 'active' | 'paused' | 'done', target: string) {
    clientRef.current?.raw(`@+typing=${state} TAGMSG ${target}`)
  }

  function requestFromBot(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = botRequestsRef.current.findIndex(r => r.resolve === resolve)
        if (idx >= 0) botRequestsRef.current.splice(idx, 1)
        reject(new Error('Bot request timed out'))
      }, 15_000)
      botRequestsRef.current.push({
        resolve: (msg: string) => { clearTimeout(timeout); resolve(msg) },
        reject: (e: Error) => { clearTimeout(timeout); reject(e) },
      })
      clientRef.current?.say(BOT_NICK, cmd)
    })
  }

  return {
    nick, connected, connStatus, isOper, messages, users, ops, bannedUsers, topic, unreadCount, awayUsers,
    typingUsers, pmTypingPeers,
    pmConversations, pmUnread, pmPeerRename,
    connect, register, disconnect, sendMessage, sendPrivMsg, sendAction, sendOper, sendMediaDelete, sendTyping,
    whois, kick, ban, unban, op, deop, changeTopic, changeNick, sayNickServ,
    addMessage, addActive, setAway, setBack, redactMediaUrl,
    clearPmUnread, openPmConversation, closePmConversation, setActivePmPeer,
    requestFromBot,
  }
}
