import { useState, useRef, useEffect } from 'react'
import IRC from 'irc-framework'
import type { Message } from '../types'
import notificationSrc from '../assets/notification.wav'

const notificationAudio = new Audio(notificationSrc)

const HOST = 'irc.lizard.fun'
const PORT = 7003

export type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export function useIrcClient() {
  const [nick, setNick] = useState('')
  const nickRef = useRef('')
  const [connected, setConnected] = useState(false)
  const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected')
  const [isOper, setIsOper] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [ops, setOps] = useState<string[]>([])
  const [bannedUsers, setBannedUsers] = useState<string[]>([])
  const [topic, setTopicState] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [awayUsers, setAwayUsers] = useState<Set<string>>(new Set())
  const [pmConversations, setPmConversations] = useState<Map<string, Message[]>>(new Map())
  const [pmUnread, setPmUnread] = useState<Map<string, number>>(new Map())

  const clientRef = useRef<InstanceType<typeof IRC.Client> | null>(null)
  const rawOutputRef = useRef(false)
  const rawOutputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const credentialsRef = useRef<{ nick: string; password: string } | null>(null)
  const manualDisconnectRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(2000)
  const focusedRef = useRef(document.hasFocus())

  useEffect(() => {
    function onFocus() { focusedRef.current = true; setUnreadCount(0) }
    function onBlur() { focusedRef.current = false }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onBlur) }
  }, [])

  function addMessage(from: string, text: string, kind: 'chat' | 'event' | 'pm' | 'action' = 'chat') {
    const isMention = (kind === 'chat' || kind === 'action') &&
      !!nickRef.current &&
      from !== nickRef.current &&
      new RegExp(`\\b${nickRef.current}\\b`, 'i').test(text)
    if (isMention) {
      notificationAudio.currentTime = 0
      notificationAudio.play().catch(() => {})
      if (!focusedRef.current) setUnreadCount(n => n + 1)
    }
    setMessages(prev => [...prev, { from, text, ts: new Date(), kind }])
  }

  function addPmMessage(peer: string, from: string, text: string, isIncoming: boolean) {
    const msg: Message = { from, text, ts: new Date(), kind: 'chat' }
    setPmConversations(prev => {
      const next = new Map(prev)
      next.set(peer, [...(next.get(peer) ?? []), msg])
      return next
    })
    if (isIncoming) {
      notificationAudio.currentTime = 0
      notificationAudio.play().catch(() => {})
      if (!focusedRef.current) setUnreadCount(n => n + 1)
      setPmUnread(prev => {
        const next = new Map(prev)
        next.set(peer, (next.get(peer) ?? 0) + 1)
        return next
      })
    }
  }

  function attachListeners(client: InstanceType<typeof IRC.Client>, chosenNick: string) {
    client.on('message', ({ nick: who, target, message }) => {
      if (!who || who === '*' || who.includes('.') || who.toLowerCase() === 'nickserv') return
      const actionMatch = message.match(/^\x01ACTION (.*)\x01$/)
      if (actionMatch) {
        addMessage(who, actionMatch[1], 'action')
        return
      }
      if (target?.toLowerCase() === '#chat') {
        addMessage(who, message)
      } else {
        addPmMessage(who, who, message, true)
      }
    })

    client.on('raw', (event: unknown) => {
      const e = event as { line?: string; from_server?: boolean }
      if (!e.from_server || !e.line) return

      // Parse `:prefix cmd params...` or `cmd params...`
      let rest = e.line
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

      if (cmd === '332' && p[1]?.toLowerCase() === '#chat' && p[2]) {
        setTopicState(p[2])
      }
      if (cmd === 'TOPIC' && p[0]?.toLowerCase() === '#chat' && p[1] !== undefined) {
        setTopicState(p[1])
        addMessage('*', `Topic changed to: ${p[1]}`, 'event')
      }
      if (cmd === '305') {
        addMessage('*', 'You are no longer marked as away.', 'event')
        setAwayUsers(prev => { const s = new Set(prev); s.delete(nickRef.current); return s })
      }
      if (cmd === '306') {
        addMessage('*', 'You have been marked as away.', 'event')
        setAwayUsers(prev => new Set([...prev, nickRef.current]))
      }
      if (cmd === '381') { setIsOper(true); client.raw('MODE #chat +b') }
      if (cmd === '367' && p[1]?.toLowerCase() === '#chat' && p[2]) {
        setBannedUsers(prev => prev.includes(p[2]) ? prev : [...prev, p[2]])
      }
      if (rawOutputRef.current && /^\d+$/.test(cmd)) {
        const text = p[p.length - 1]
        if (text) addMessage(cmd, text, 'event')
      }
    })

    client.on('whois', (e) => {
      const lines: string[] = []
      if (e.idle !== undefined) lines.push(`${e.nick} has been idle ${e.idle}s`)
      if (e.operator) lines.push(`  ${e.nick} is a server admin`)
      for (const line of lines) addMessage('*', line, 'event')
    })

    client.on('mode', (event: unknown) => {
      const e = event as { target?: string; modes?: Array<{ mode: string; param?: string }> }
      // Server oper: user mode +o directly on the nick
      if (e.target === chosenNick && e.modes?.some(m => m.mode === '+o')) {
        setIsOper(true)
      }
      // Channel oper: +o/-o on the nick within #chat
      if (e.target?.toLowerCase() === '#chat') {
        for (const m of e.modes ?? []) {
          if (m.mode === '+o' && m.param) {
            setOps(prev => prev.includes(m.param!) ? prev : [...prev, m.param!])
            if (m.param === chosenNick) setIsOper(true)
            addMessage('*', `${m.param} is now a moderator`, 'event')
          }
          if (m.mode === '-o' && m.param) {
            setOps(prev => prev.filter(u => u !== m.param))
            if (m.param === chosenNick) setIsOper(false)
            addMessage('*', `${m.param} is no longer a moderator`, 'event')
          }
        }
      }
      if (e.target?.toLowerCase() === '#chat') {
        for (const m of e.modes ?? []) {
          if (m.mode === '+b' && m.param) {
            setBannedUsers(prev => prev.includes(m.param!) ? prev : [...prev, m.param!])
            addMessage('*', `${m.param} has been banned`, 'event')
          }
          if (m.mode === '-b' && m.param) {
            setBannedUsers(prev => prev.filter(u => u !== m.param))
            addMessage('*', `${m.param} has been unbanned`, 'event')
          }
        }
      }
    })

    // Track away status for self and other users via irc-framework's native away/back events
    client.on('away', (event: unknown) => {
      const e = event as { nick: string }
      setAwayUsers(prev => new Set([...prev, e.nick]))
    })
    client.on('back', (event: unknown) => {
      const e = event as { nick: string }
      setAwayUsers(prev => { const s = new Set(prev); s.delete(e.nick); return s })
    })

    client.on('join', ({ nick: who, channel }) => {
      if (who === chosenNick) return
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
      addMessage('*', `${e.nick} has left${e.message ? ` (${e.message})` : ''}`, 'event')
    })

    client.on('quit', (event: unknown) => {
      const e = event as { nick: string; message?: string }
      setUsers(prev => prev.filter(u => u !== e.nick))
      setAwayUsers(prev => { const s = new Set(prev); s.delete(e.nick); return s })
      addMessage('*', `${e.nick} has quit`, 'event')
    })

    client.on('userlist', (event: unknown) => {
      const e = event as { channel: string; users: Array<{ nick: string; modes: string[] }> }
      if (e.channel.toLowerCase() !== '#chat') return
      setUsers(e.users.map(u => u.nick).filter(n => n.toLowerCase() !== 'chanserv').sort((a, b) => a.localeCompare(b)))
      setOps(e.users.filter(u => u.modes.includes('o')).map(u => u.nick))
      const self = e.users.find(u => u.nick === chosenNick)
      if (self?.modes.includes('o')) setIsOper(true)
    })

    client.on('nick', (event: unknown) => {
      const e = event as { nick: string; new_nick: string }
      if (e.nick === chosenNick) { setNick(e.new_nick); nickRef.current = e.new_nick }
      setUsers(prev => prev.map(u => u === e.nick ? e.new_nick : u).sort((a, b) => a.localeCompare(b)))
      setOps(prev => prev.map(u => u === e.nick ? e.new_nick : u))
      setAwayUsers(prev => {
        if (!prev.has(e.nick)) return prev
        const s = new Set(prev); s.delete(e.nick); s.add(e.new_nick); return s
      })
      addMessage('*', `${e.nick} is now known as ${e.new_nick}`, 'event')
    })

    client.on('notice', (event: unknown) => {
      const e = event as { nick?: string; message?: string; notice?: string }
      let text = e.message ?? e.notice ?? ''
      if (!text) return
      if (e.nick?.toLowerCase() === 'nickserv') {
        // Drop "Last login from: <user>@<host> on <date>." lines
        if (/^Last login from:/i.test(text)) return
        // Drop network welcome/service intro messages
        if (/^Welcome to /i.test(text)) return
        // Replace "/msg NickServ IDENTIFY [nick] <password>" with "/identify <password>"
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
      if (manualDisconnectRef.current) {
        manualDisconnectRef.current = false
        setConnStatus('disconnected')
        addMessage('*', 'Disconnected.', 'event')
        return
      }

      // Unexpected disconnect — schedule reconnect with exponential backoff
      const delay = reconnectDelayRef.current
      reconnectDelayRef.current = Math.min(delay * 2, 30000)
      setConnStatus('reconnecting')
      addMessage('*', `Disconnected. Reconnecting in ${delay / 1000}s…`, 'event')
      reconnectTimerRef.current = setTimeout(() => {
        if (credentialsRef.current) {
          connectCore(credentialsRef.current.nick, credentialsRef.current.password, true)
        }
      }, delay)
    })

    client.on('error', (err) => {
      addMessage('!', err.message)
    })
  }

  function connectCore(chosenNick: string, password: string, isReconnect: boolean) {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const client = new IRC.Client()
    client.connect({ host: HOST, port: PORT, nick: chosenNick, tls: true })

    client.on('registered', () => {
      setConnected(true)
      setConnStatus('connected')
      reconnectDelayRef.current = 2000 // reset backoff on successful connect
      if (isReconnect) {
        addMessage('*', 'Reconnected.', 'event')
      } else {
        addMessage('*', 'Connected')
        addMessage('*', `You are now logged in as ${chosenNick}`)
      }
      if (password) {
        client.say('NickServ', `IDENTIFY ${password}`)
        client.raw(`OPER ${chosenNick} ${password}`)
      }
      client.join('#chat')
    })

    attachListeners(client, chosenNick)
    clientRef.current = client
  }

  function connect(chosenNick: string, password: string) {
    clientRef.current?.quit('Reconnecting')
    clientRef.current = null
    manualDisconnectRef.current = false
    const normalizedNick = chosenNick.replace(' ', '_')
    setNick(normalizedNick)
    nickRef.current = normalizedNick
    credentialsRef.current = { nick: normalizedNick, password }
    reconnectDelayRef.current = 2000
    setConnStatus('connecting')
    connectCore(normalizedNick, password, false)
  }

  function register(chosenNick: string, password: string, email: string) {
    setNick(chosenNick)
    nickRef.current = chosenNick
    credentialsRef.current = { nick: chosenNick, password }
    manualDisconnectRef.current = false
    reconnectDelayRef.current = 2000
    setConnStatus('connecting')

    const client = new IRC.Client()
    client.connect({ host: HOST, port: PORT, nick: chosenNick, tls: true })

    client.on('registered', () => {
      setConnected(true)
      setConnStatus('connected')
      reconnectDelayRef.current = 2000
      addMessage('*', 'Connected')
      addMessage('*', `You are now logged in as ${chosenNick}`)
      client.say('NickServ', `REGISTER ${password} ${email}`)
      client.join('#chat')
    })

    attachListeners(client, chosenNick)
    clientRef.current = client
  }

  function disconnect() {
    manualDisconnectRef.current = true
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    clientRef.current?.quit('Goodbye')
    clientRef.current = null
    setConnected(false)
    setConnStatus('disconnected')
    setIsOper(false)
    setUsers([])
    setOps([])
    setBannedUsers([])
    setAwayUsers(new Set())
    addMessage('*', 'Disconnected.', 'event')
  }

  function sendMessage(text: string) {
    if (!text.trim() || !clientRef.current) return
    clientRef.current.say('#chat', text)
    addMessage(nick, text)
  }

  function sendPrivMsg(target: string, text: string) {
    if (!text.trim() || !clientRef.current) return
    clientRef.current.say(target, text)
    addPmMessage(target, nickRef.current, text, false)
  }

  function clearPmUnread(peer: string) {
    setPmUnread(prev => {
      if (!prev.get(peer)) return prev
      const next = new Map(prev)
      next.delete(peer)
      return next
    })
  }

  function closePmConversation(peer: string) {
    setPmConversations(prev => {
      const next = new Map(prev)
      next.delete(peer)
      return next
    })
    setPmUnread(prev => {
      if (!prev.has(peer)) return prev
      const next = new Map(prev)
      next.delete(peer)
      return next
    })
  }

  function sendRaw(command: string) {
    if (!clientRef.current) return
    rawOutputRef.current = true
    if (rawOutputTimerRef.current) clearTimeout(rawOutputTimerRef.current)
    rawOutputTimerRef.current = setTimeout(() => { rawOutputRef.current = false }, 5000)
    clientRef.current.raw(command)
  }

  function whois(target: string) {
    clientRef.current?.raw(`WHOIS ${target}`)
  }

  function kick(target: string) {
    clientRef.current?.raw(`KICK #chat ${target}`)
  }

  function ban(target: string) {
    clientRef.current?.raw(`MODE #chat +b ${target}`)
    clientRef.current?.raw(`KICK #chat ${target}`)
  }

  function unban(mask: string) {
    clientRef.current?.raw(`MODE #chat -b ${mask}`)
  }

  function op(target: string) {
    clientRef.current?.raw(`MODE #chat +o ${target}`)
  }

  function deop(target: string) {
    clientRef.current?.raw(`MODE #chat -o ${target}`)
  }

  function changeTopic(newTopic: string) {
    clientRef.current?.raw(`TOPIC #chat :${newTopic}`)
  }

  function changeNick(newNick: string) {
    if (!clientRef.current) return
    clientRef.current.raw(`NICK ${newNick.replace(' ', '_')}`)
  }

  function sayNickServ(text: string) {
    clientRef.current?.say('NickServ', text)
  }

  function sendAction(text: string) {
    if (!text.trim() || !clientRef.current) return
    clientRef.current.say('#chat', `\x01ACTION ${text}\x01`)
    addMessage(nick, text, 'action')
  }

  function setAway(message: string) {
    clientRef.current?.raw(`AWAY :${message}`)
  }

  function setBack() {
    clientRef.current?.raw('AWAY')
  }

  return { nick, connected, connStatus, isOper, messages, users, ops, bannedUsers, topic, unreadCount, awayUsers, pmConversations, pmUnread, connect, register, disconnect, sendMessage, sendPrivMsg, sendRaw, whois, kick, ban, unban, op, deop, changeTopic, changeNick, sayNickServ, addMessage, sendAction, setAway, setBack, clearPmUnread, closePmConversation }
}
