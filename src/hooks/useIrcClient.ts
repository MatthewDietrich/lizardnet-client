import { useState, useRef, useEffect } from 'react'
import IRC from 'irc-framework'
import type { Settings } from './useSettings'
import { encryptCreds, decryptCreds } from '../lib/credentials'
import { useReconnect } from './useReconnect'
import { CHANNEL } from '../lib/constants'
import type {
  IrcMessageEvent, IrcRawEvent, IrcTopicEvent, IrcErrorEvent, IrcBanlistEvent,
  IrcModeEvent, IrcNickPresenceEvent, IrcPartEvent, IrcQuitEvent,
  IrcUserlistEvent, IrcNickEvent, IrcNoticeEvent, IrcTagmsgEvent,
} from '../types/ircEvents'
import { usePmConversations } from './usePmConversations'
import { useIrcMessages } from './useIrcMessages'
import { useIrcUsers } from './useIrcUsers'
import { useBotProtocol } from './useBotProtocol'
import { useIrcModeration } from './useIrcModeration'
import { parseRawLine } from '../lib/parseRawLine'

export type { ConnStatus } from './useReconnect'

const HOST = 'irc.lizard.fun'
const PORT = 7003
const RATE_LIMIT = { messages: 5, windowMs: 4000 }
import { BOT_NICK } from '../lib/constants'
const SERVICES_HOST = 'services.int'

export function useIrcClient(settings: Settings) {
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const [nick, setNick] = useState('')
  const nickRef = useRef('')
  const [connected, setConnected] = useState(false)
  const [isIdentified, setIsIdentified] = useState(false)
  const focusedRef = useRef(document.hasFocus())
  const clientRef = useRef<InstanceType<typeof IRC.Client> | null>(null)
  const credentialsRef = useRef<Awaited<ReturnType<typeof encryptCreds>> | null>(null)
  const sendTimestampsRef = useRef<number[]>([])

  function sanitize(s: string) { return s.replace(/[\r\n]/g, '') }

  const { connStatus, setConnStatus, connStatusRef, manualDisconnectRef, schedule, cancel: cancelReconnect, resetDelay } = useReconnect()

  const {
    messages,
    unreadCount, setUnreadCount,
    addMessage, editMessageByMsgid, injectChannelMsgid, redactChannelUrl, deleteMessageByMsgid,
  } = useIrcMessages({ nickRef, focusedRef, settingsRef })

  const {
    pmConversations, pmUnread, pmPeerRename,
    setActivePmPeer, addPmMessage, addActiveEvent,
    openPmConversation, closePmConversation, clearPmUnread, clearActivePeerUnread,
    handlePeerRename, redactInPmConversations, editPmMessage, injectPmMsgid,
  } = usePmConversations({ focusedRef, settingsRef, onChannelUnread: () => setUnreadCount(n => n + 1) })

  const {
    users, setUsers,
    ops, setOps,
    bannedUsers, setBannedUsers,
    awayUsers, setAwayUsers,
    isOper, setIsOper,
    topic, setTopicState,
    typingUsers, handleTypingUser,
    pmTypingPeers, handlePmTyping,
    resetUsers,
  } = useIrcUsers()

  const { requestFromBot, handleBotNotice } = useBotProtocol({ clientRef })

  const {
    silentWhoisRef, maskToNickRef,
    handleWhoisForBan,
    kick, ban, unban, op, deop,
  } = useIrcModeration({ clientRef })

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

  function addActive(text: string) {
    addActiveEvent(text, () => addMessage('*', text, 'event'))
  }

  function redactMediaUrl(url: string) {
    const replace = (text: string) => text.replace(url, '[media deleted]')
    redactChannelUrl(url, replace)
    redactInPmConversations(url, replace)
  }

  function attachListeners(client: InstanceType<typeof IRC.Client>) {
    client.on('message', (event: unknown) => {
      const { nick: who, target, message, type, tags } = event as IrcMessageEvent
      if (!who || who === '*' || who.includes('.') || who.toLowerCase() === 'nickserv') return
      if (who.toLowerCase() === BOT_NICK.toLowerCase()) {
        if (target?.toLowerCase() === CHANNEL) {
          const trimmed = message.trim()
          if (trimmed.startsWith('MEDIADELETE ')) {
            const url = trimmed.slice('MEDIADELETE '.length).trim()
            if (url) redactMediaUrl(url)
          }
          if (trimmed.startsWith('MSGDELETE ')) {
            const msgid = trimmed.slice('MSGDELETE '.length).trim()
            if (msgid) deleteMessageByMsgid(msgid)
          }
        }
        return
      }
      const isAction = type === 'action'
      const serverTime = tags?.['server-time'] ? new Date(tags['server-time']) : undefined
      const isHistory = (event as any).batch?.type === 'chathistory'
      const isEcho = 'inspircd.org/echo' in (tags ?? {})
      const msgid = tags?.['msgid']
      const editOf = tags?.['+draft/edit']
      if (target?.toLowerCase() === CHANNEL) {
        if (editOf) editMessageByMsgid(editOf, message)
        else if (isEcho) { if (msgid) injectChannelMsgid(message, msgid) }
        else addMessage(who, message, isAction ? 'action' : 'chat', serverTime, isHistory, msgid)
      } else {
        const peer = isEcho ? target : who
        if (editOf) editPmMessage(peer, editOf, message)
        else if (isEcho) { if (msgid) injectPmMsgid(peer, who, message, msgid) }
        else addPmMessage(peer, who, message, !isEcho, isAction ? 'action' : 'chat', msgid)
      }
    })

    client.on('raw', (event: unknown) => {
      const e = event as IrcRawEvent
      if (!e.from_server || !e.line) return
      const { cmd } = parseRawLine(e.line)
      if (cmd === '381') { setIsOper(true); client.raw('MODE #chat +b'); addActive('You are now a server operator.') }
      if (cmd === '491') addActive('OPER failed: no O-lines for your host.')
    })

    client.on('topic', (event: unknown) => {
      const e = event as IrcTopicEvent
      if (e.channel?.toLowerCase() !== CHANNEL) return
      setTopicState(e.topic ?? '')
      if (e.nick) addMessage('*', `Topic changed to: ${e.topic}`, 'event')
    })

    client.on('loggedin', () => { setIsIdentified(true) })

    client.on('irc error', (event: unknown) => {
      const e = event as IrcErrorEvent
      if (e.command === '464') addActive('OPER failed: incorrect password.')
      if (e.command === '474' || e.command === '465') addActive('You have been banned.')
    })

    client.on('banlist', (event: unknown) => {
      const e = event as IrcBanlistEvent
      if (e.channel?.toLowerCase() !== CHANNEL) return
      for (const b of e.bans ?? []) {
        if (b.ban) setBannedUsers(prev => prev.includes(b.ban) ? prev : [...prev, b.ban])
      }
    })

    client.on('batch end chathistory', () => {
      addMessage('*', '─── history above ───', 'event')
    })

    client.on('whois', (e) => {
      if (handleWhoisForBan(e)) return
      if (silentWhoisRef.current.has(e.nick)) { silentWhoisRef.current.delete(e.nick); return }
      const lines: string[] = []
      if (e.idle !== undefined) lines.push(`${e.nick} has been idle ${e.idle}s`)
      if (e.operator) lines.push(`  ${e.nick} is a server admin`)
      for (const line of lines) addMessage('*', line, 'event')
    })

    client.on('mode', (event: unknown) => {
      const e = event as IrcModeEvent
      if (e.target === nickRef.current && e.modes?.some(m => m.mode === '+o')) setIsOper(true)
      if (e.target?.toLowerCase() === CHANNEL) {
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
      const e = event as IrcNickPresenceEvent
      setAwayUsers(prev => new Set([...prev, e.nick]))
    })
    client.on('back', (event: unknown) => {
      const e = event as IrcNickPresenceEvent
      setAwayUsers(prev => { const s = new Set(prev); s.delete(e.nick); return s })
    })

    client.on('join', ({ nick: who, channel }) => {
      if (who === nickRef.current) return
      if (channel.toLowerCase() !== CHANNEL) return
      if (who.toLowerCase() === 'chanserv') return
      setUsers(prev => prev.includes(who) ? prev : [...prev, who].sort((a, b) => a.localeCompare(b)))
      addMessage('*', `${who} has joined`, 'event')
    })

    client.on('kick', ({ kicked, nick: by, channel }) => {
      if (channel.toLowerCase() !== CHANNEL) return
      setUsers(prev => prev.filter(u => u !== kicked))
      addMessage('*', `${kicked} was kicked by ${by}`, 'event')
    })

    client.on('part', (event: unknown) => {
      const e = event as IrcPartEvent
      if (e.channel.toLowerCase() !== CHANNEL) return
      setUsers(prev => prev.filter(u => u !== e.nick))
      setAwayUsers(prev => { const s = new Set(prev); s.delete(e.nick); return s })
      handleTypingUser(e.nick, 'done')
      handlePmTyping(e.nick, 'done')
      addMessage('*', `${e.nick} has left${e.message ? ` (${e.message})` : ''}`, 'event')
    })

    client.on('quit', (event: unknown) => {
      const e = event as IrcQuitEvent
      setUsers(prev => prev.filter(u => u !== e.nick))
      setAwayUsers(prev => { const s = new Set(prev); s.delete(e.nick); return s })
      handleTypingUser(e.nick, 'done')
      handlePmTyping(e.nick, 'done')
      addMessage('*', `${e.nick} has quit`, 'event')
    })

    client.on('userlist', (event: unknown) => {
      const e = event as IrcUserlistEvent
      if (e.channel.toLowerCase() !== CHANNEL) return
      setUsers(e.users.map(u => u.nick).filter(n => n.toLowerCase() !== 'chanserv').sort((a, b) => a.localeCompare(b)))
      setOps(e.users.filter(u => u.modes.includes('o')).map(u => u.nick))
      const self = e.users.find(u => u.nick === nickRef.current)
      if (self?.modes.includes('o')) setIsOper(true)
    })

    client.on('nick', (event: unknown) => {
      const e = event as IrcNickEvent
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
      const e = event as IrcNoticeEvent
      const text = e.message ?? e.notice ?? ''
      if (!text) return
      if (handleBotNotice(e.nick, text)) return
      if (e.nick?.toLowerCase() === 'nickserv' && e.hostname === SERVICES_HOST) {
        if (/^Last login from:/i.test(text)) return
        if (/^Welcome to /i.test(text)) return
        addMessage('NickServ', text.replace(/\/msg NickServ IDENTIFY(?:\s+\S+)?\s+(\S+)/gi, '/identify $1'), 'event')
      }
    })

    client.on('close', () => {
      if (clientRef.current !== client) return
      clientRef.current = null
      setConnected(false)
      setIsIdentified(false)
      resetUsers()
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
      const e = event as IrcTagmsgEvent
      if (!e.nick || e.nick === nickRef.current) return
      const target = e.target?.toLowerCase()
      if (target === CHANNEL) handleTypingUser(e.nick, e.tags?.['+typing'])
      else if (target === nickRef.current.toLowerCase()) handlePmTyping(e.nick, e.tags?.['+typing'])
    })

    client.on('error', (err) => { addMessage('!', err.message) })
  }

  function connectCore(chosenNick: string, password: string, isReconnect: boolean, nickServCommand?: string) {
    cancelReconnect()
    const client = new IRC.Client()
    ;(client as any).requestCap('message-ids')
    ;(client as any).requestCap('echo-message')
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
      client.join(CHANNEL)
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
    setIsIdentified(false)
    resetUsers()
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
    clientRef.current.say(CHANNEL, text)
    addMessage(nickRef.current, text)
  }

  function sendPrivMsg(target: string, text: string) {
    if (!text.trim() || !clientRef.current) return
    if (!checkRateLimit()) return
    clientRef.current.say(target, text)
    addPmMessage(target, nickRef.current, text, false)
  }

  function sendAction(text: string, target = CHANNEL) {
    if (!text.trim() || !clientRef.current) return
    clientRef.current.say(target, `\x01ACTION ${text}\x01`)
    if (target === CHANNEL) addMessage(nickRef.current, text, 'action')
    else addPmMessage(target, nickRef.current, text, false, 'action')
  }

  function whois(target: string) { clientRef.current?.raw(`WHOIS ${sanitize(target)}`) }
  function changeTopic(newTopic: string) { clientRef.current?.raw(`TOPIC #chat :${sanitize(newTopic)}`) }
  function changeNick(newNick: string) { clientRef.current?.raw(`NICK ${sanitize(newNick).replace(/ /g, '_')}`) }
  function sayNickServ(text: string) { clientRef.current?.say('NickServ', text) }
  function setAway(message: string) { clientRef.current?.raw(`AWAY :${sanitize(message)}`) }
  function setBack() { clientRef.current?.raw('AWAY') }
  function sendOper(name: string, password: string) { clientRef.current?.raw(`OPER ${sanitize(name)} ${sanitize(password)}`) }
  function sendMediaDelete(url: string) { clientRef.current?.raw(`PRIVMSG #chat :MEDIADELETE ${sanitize(url)}`) }
  function sendMsgDelete(msgid: string) { clientRef.current?.say(BOT_NICK, `REDACT ${sanitize(msgid)}`) }
  function sendTyping(state: 'active' | 'paused' | 'done', target: string) {
    clientRef.current?.raw(`@+typing=${state} TAGMSG ${target}`)
  }

  function sendEdit(msgid: string, newText: string, target: string) {
    if (!clientRef.current) return
    clientRef.current.raw(`@+draft/edit=${msgid} PRIVMSG ${target} :${sanitize(newText)}`)
    if (target.toLowerCase() === CHANNEL) editMessageByMsgid(msgid, newText)
    else editPmMessage(target, msgid, newText)
  }

  return {
    nick, connected, connStatus, isOper, isIdentified, messages, users, ops, bannedUsers, topic, unreadCount, awayUsers,
    typingUsers, pmTypingPeers,
    pmConversations, pmUnread, pmPeerRename,
    connect, register, disconnect, sendMessage, sendPrivMsg, sendAction, sendOper, sendMediaDelete, sendMsgDelete, sendTyping, sendEdit,
    whois, kick, ban, unban, op, deop, changeTopic, changeNick, sayNickServ,
    addMessage, addActive, setAway, setBack, redactMediaUrl,
    clearPmUnread, openPmConversation, closePmConversation, setActivePmPeer,
    requestFromBot,
  }
}
