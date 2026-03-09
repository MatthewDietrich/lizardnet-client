import { useEffect, useRef } from 'react'
import { parseIrc } from '../ircFormat'
import type { Message } from '../types'

interface Props {
  messages: Message[]
}

export default function MessageList({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      className="border rounded p-3 bg-light font-monospace flex-grow-1"
      style={{ overflowY: 'auto', fontSize: 13 }}
    >
      {messages.length === 0 && <span className="text-muted">No messages yet.</span>}
      {messages.map((m, i) => {
        const ts = <span style={{ fontSize: 11, color: 'var(--c-disabled-fg)' }}>{m.ts.toLocaleTimeString()}</span>
        if (m.kind === 'event') return (
          <div key={i} className="fst-italic" style={{ fontSize: 12, color: 'var(--c-tertiary)' }}>
            {ts}{' '}{parseIrc(m.text)}
          </div>
        )
        if (m.kind === 'action') return (
          <div key={i} className="fst-italic">
            {ts}{' '}<strong>{m.from}</strong> {parseIrc(m.text)}
          </div>
        )
        if (m.kind === 'pm') return (
          <div key={i} style={{ color: 'var(--c-quaternary)' }}>
            {ts}{' '}<span style={{ opacity: 0.6 }}>[PM]</span> <strong>{m.from}</strong>: {parseIrc(m.text)}
          </div>
        )
        return (
          <div key={i}>
            {ts}{' '}<strong>{m.from}</strong>: {parseIrc(m.text)}
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
