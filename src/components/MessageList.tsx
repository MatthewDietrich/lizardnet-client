import { useEffect, useRef } from 'react'
import { parseIrc } from '../ircFormat'
import type { Message } from '../types'

interface Props {
  messages: Message[]
  nick: string
}

export default function MessageList({ messages, nick }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function isMention(text: string) {
    if (!nick) return false
    return new RegExp(`\\b${nick}\\b`, 'i').test(text)
  }

  const mentionStyle = {
    background: 'rgba(var(--c-quaternary-rgb, 190, 188, 154), 0.1)',
    borderLeft: '2px solid var(--c-quaternary)',
    paddingLeft: '0.4em',
    marginLeft: '-0.5em',
  }

  return (
    <div
      className="border rounded p-3 bg-light font-monospace flex-grow-1"
      style={{ overflowY: 'auto', fontSize: 13 }}
    >
      {messages.length === 0 && <span className="text-muted">No messages yet.</span>}
      {messages.map((m, i) => {
        const ts = <span style={{ fontSize: 11, color: 'var(--c-disabled-fg)' }}>{m.ts.toLocaleTimeString()}</span>
        const mentioned = (!m.kind || m.kind === 'chat' || m.kind === 'action') && m.from !== nick && isMention(m.text)
        if (m.kind === 'event') return (
          <div key={i} className="fst-italic" style={{ fontSize: 12, color: 'var(--c-tertiary)' }}>
            {ts}{' '}{parseIrc(m.text)}
          </div>
        )
        if (m.kind === 'action') return (
          <div key={i} className="fst-italic" style={mentioned ? mentionStyle : undefined}>
            {ts}{' '}<strong>{m.from}</strong> {parseIrc(m.text)}
          </div>
        )
        if (m.kind === 'pm') return (
          <div key={i} style={{ color: 'var(--c-quaternary)' }}>
            {ts}{' '}<span style={{ opacity: 0.6 }}>[PM]</span> <strong>{m.from}</strong>: {parseIrc(m.text)}
          </div>
        )
        return (
          <div key={i} style={mentioned ? mentionStyle : undefined}>
            {ts}{' '}<strong>{m.from}</strong>: {parseIrc(m.text)}
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
