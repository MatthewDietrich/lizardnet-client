import { useState, useRef } from 'react'
import IRC from 'irc-framework'
import type { Message } from '../types'

const HOST = 'irc.lizard.fun'
const PORT = 7003

export function useIrcClient() {
  const [nick, setNick] = useState('')
  const [connected, setConnected] = useState(false)
  const [isOper, setIsOper] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [ops, setOps] = useState<string[]>([])
  const [bannedUsers, setBannedUsers] = useState<string[]>([])
  const [topic, setTopicState] = useState('')

  const clientRef = useRef<InstanceType<typeof IRC.Client> | null>(null)
  const rawOutputRef = useRef(false)
  const rawOutputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function addMessage(from: string, text: string, kind: 'chat' | 'event' | 'pm' = 'chat') {
    setMessages(prev => [...prev, { from, text, ts: new Date(), kind }])
  }

  function attachListeners(client: InstanceType<typeof IRC.Client>, chosenNick: string) {
    client.on('message', ({ nick: who, target, message }) => {
      if (!who || who === '*' || who.includes('.') || who.toLowerCase() === 'nickserv') return
      if (target?.toLowerCase() === '#chat') {
        addMessage(who, message)
      } else {
        addMessage(who, message, 'pm')
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
      addMessage('*', `${e.nick} has left${e.message ? ` (${e.message})` : ''}`, 'event')
    })

    client.on('quit', (event: unknown) => {
      const e = event as { nick: string; message?: string }
      setUsers(prev => prev.filter(u => u !== e.nick))
      addMessage('*', `${e.nick} has quit${e.message ? ` (${e.message})` : ''}`, 'event')
    })

    client.on('userlist', (event: unknown) => {
      const e = event as { channel: string; users: Array<{ nick: string; modes: string[] }> }
      if (e.channel.toLowerCase() !== '#chat') return
      setUsers(e.users.map(u => u.nick).filter(n => n.toLowerCase() !== 'chanserv').sort((a, b) => a.localeCompare(b)))
      setOps(e.users.filter(u => u.modes.includes('o')).map(u => u.nick))
      const self = e.users.find(u => u.nick === chosenNick)
      if (self?.modes.includes('o')) setIsOper(true)
    })

    client.on('notice', () => { /* suppress */ })

    client.on('close', () => {
      if (clientRef.current !== client) return
      clientRef.current = null
      setConnected(false)
      setIsOper(false)
      setUsers([])
      setOps([])
      setBannedUsers([])
      addMessage('*', 'Disconnected.', 'event')
    })

    client.on('error', (err) => {
      addMessage('!', err.message)
    })
  }

  function connect(chosenNick: string, password: string) {
    clientRef.current?.quit('Reconnecting')
    clientRef.current = null
    const normalizedNick = chosenNick.replace(" ", "_")
    setNick(normalizedNick)

    const client = new IRC.Client()
    client.connect({ host: HOST, port: PORT, nick: normalizedNick, tls: true })

    client.on('registered', () => {
      setConnected(true)
      addMessage('*', 'Connected')
      addMessage('*', `You are now logged in as ${normalizedNick}`)
      if (password) {
        client.say('NickServ', `IDENTIFY ${password}`)
        client.raw(`OPER ${chosenNick} ${password}`)
      }
      client.join('#chat')
    })

    attachListeners(client, normalizedNick)
    clientRef.current = client
  }

  function register(chosenNick: string, password: string, email: string) {
    setNick(chosenNick)

    const client = new IRC.Client()
    client.connect({ host: HOST, port: PORT, nick: chosenNick, tls: true })

    client.on('registered', () => {
      setConnected(true)
      addMessage('*', 'Connected')
      addMessage('*', `You are now logged in as ${chosenNick}`)
      client.say('NickServ', `REGISTER ${password} ${email}`)
      client.join('#chat')
    })

    attachListeners(client, chosenNick)
    clientRef.current = client
  }

  function disconnect() {
    clientRef.current?.quit('Goodbye')
    clientRef.current = null
    setConnected(false)
    setIsOper(false)
    setUsers([])
    setOps([])
    setBannedUsers([])
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
    addMessage('*', `-> ${target}: ${text}`, 'event')
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

  return { nick, connected, isOper, messages, users, ops, bannedUsers, topic, connect, register, disconnect, sendMessage, sendPrivMsg, sendRaw, whois, kick, ban, unban, op, deop, changeTopic }
}
