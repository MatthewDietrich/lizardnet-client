import { useRef, useMemo, memo, useLayoutEffect } from 'react'
import { parseIrc } from '../ircFormat'
import type { Message } from '../types'

interface Props {
  messages: Message[]
  nick: string
}

const mentionStyle = {
  background: 'rgba(var(--c-quaternary-rgb, 190, 188, 154), 0.1)',
  borderLeft: '2px solid var(--c-quaternary)',
  paddingLeft: '0.4em',
  marginLeft: '-0.5em',
}

const MessageRow = memo(function MessageRow({ m, mentioned }: { m: Message; mentioned: boolean }) {
  const ts = <span style={{ fontSize: 11, color: 'var(--c-disabled-fg)' }}>{m.ts.toLocaleTimeString()}</span>
  if (m.kind === 'event') return (
    <div className="fst-italic" style={{ fontSize: 12, color: 'var(--c-tertiary)' }}>
      {ts}{' '}{parseIrc(m.text)}
    </div>
  )
  if (m.kind === 'action') return (
    <div className="fst-italic" style={mentioned ? mentionStyle : undefined}>
      {ts}{' '}<strong>{m.from}</strong> {parseIrc(m.text)}
    </div>
  )
  if (m.kind === 'pm') return (
    <div style={{ color: 'var(--c-quaternary)' }}>
      {ts}{' '}<span style={{ opacity: 0.6 }}>[PM]</span> <strong>{m.from}</strong>: {parseIrc(m.text)}
    </div>
  )
  return (
    <div style={mentioned ? mentionStyle : undefined}>
      {ts}{' '}<strong>{m.from}</strong>: {parseIrc(m.text)}
    </div>
  )
})

export default function MessageList({ messages, nick }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView()
  }, [messages])

  const mentionRegex = useMemo(() => nick ? new RegExp(`\\b${nick}\\b`, 'i') : null, [nick])

  return (
    <div
      className="border rounded p-3 bg-light font-monospace flex-grow-1"
      style={{ overflowY: 'auto', fontSize: 13 }}
    >
      {messages.length === 0 && <span className="text-muted">No messages yet.</span>}
      {messages.map((m, i) => {
        const mentioned = (!m.kind || m.kind === 'chat' || m.kind === 'action') &&
          m.from !== nick && !!mentionRegex?.test(m.text)
        return <MessageRow key={i} m={m} mentioned={mentioned} />
      })}
      <div ref={endRef} />
    </div>
  )
}
