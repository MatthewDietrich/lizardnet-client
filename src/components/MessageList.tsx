import { useRef, useMemo, memo, useLayoutEffect, useState, useEffect, useCallback } from 'react'
import { parseIrc } from '../ircFormat'
import type { Message } from '../types'

interface Props {
  messages: Message[]
  nick: string
  onNickClick?: (nick: string, pos: { x: number; y: number }) => void
  canDeleteMedia?: boolean
  onDeleteMedia?: (url: string) => void
}

const EMOJI_ONLY_RE = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f\u20e3]+$/u

const mentionStyle = {
  background: 'rgba(var(--c-quaternary-rgb, 190, 188, 154), 0.1)',
  borderLeft: '2px solid var(--c-quaternary)',
  paddingLeft: '0.4em',
  marginLeft: '-0.5em',
}

function highlight(text: string, term: string) {
  if (!term) return text
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase()
      ? <mark key={i} style={{ padding: 0, background: 'rgba(255,220,0,0.5)', color: 'inherit' }}>{part}</mark>
      : part
  )
}

const gridRow = { display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.4em' }

const MessageRow = memo(function MessageRow({ m, mentioned, searchTerm, onNickClick, onDeleteMedia }: { m: Message; mentioned: boolean; searchTerm: string; onNickClick?: (nick: string, pos: { x: number; y: number }) => void; onDeleteMedia?: (url: string) => void }) {
  const ts = <span style={{ fontSize: 11, color: 'var(--c-disabled-fg)', whiteSpace: 'nowrap' }}>{m.ts.toLocaleTimeString()}</span>
  const text = searchTerm ? highlight(m.text, searchTerm) : parseIrc(m.text, onDeleteMedia)
  const fromText = searchTerm ? highlight(m.from, searchTerm) : m.from
  const from = m.from && m.from !== '*' && m.kind !== 'event' && onNickClick
    ? <strong style={{ cursor: 'pointer' }} onClick={e => onNickClick(m.from, { x: e.clientX, y: e.clientY })}>{fromText}</strong>
    : <strong>{fromText}</strong>
  if (m.kind === 'event') return (
    <div className="fst-italic" style={{ ...gridRow, fontSize: 12, color: 'var(--c-tertiary)' }}>
      {ts}<span>{searchTerm ? highlight(m.text, searchTerm) : parseIrc(m.text, onDeleteMedia)}</span>
    </div>
  )
  if (m.kind === 'action') return (
    <div className="fst-italic" style={mentioned ? { ...gridRow, ...mentionStyle } : gridRow}>
      {ts}<span>{from} {text}</span>
    </div>
  )
  if (m.kind === 'pm') return (
    <div style={{ ...gridRow, color: 'var(--c-quaternary)' }}>
      {ts}<span><span style={{ opacity: 0.6 }}>[PM]</span> {from}: {text}</span>
    </div>
  )
  const emojiOnly = EMOJI_ONLY_RE.test(m.text.trim())
  return (
    <div style={mentioned ? { ...gridRow, ...mentionStyle } : gridRow}>
      {ts}
      <span>{from}:{' '}<span style={emojiOnly ? { fontSize: 36, lineHeight: 1.1 } : undefined}>{text}</span></span>
    </div>
  )
})

export default function MessageList({ messages, nick, onNickClick, canDeleteMedia, onDeleteMedia }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const atBottomRef = useRef(true)
  const prevLengthRef = useRef(0)
  const [newCount, setNewCount] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onScroll() {
      const el = containerRef.current!
      atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      if (atBottomRef.current) setNewCount(0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    if (searchOpen) return
    const wasEmpty = prevLengthRef.current === 0
    prevLengthRef.current = messages.length
    if (wasEmpty || atBottomRef.current) {
      endRef.current?.scrollIntoView()
      atBottomRef.current = true
      setNewCount(0)
    } else {
      setNewCount(n => n + 1)
    }
  }, [messages, searchOpen])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') {
        closeSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchTerm('')
    atBottomRef.current = true
    setTimeout(() => endRef.current?.scrollIntoView(), 0)
  }, [])

  function scrollToBottom() {
    endRef.current?.scrollIntoView()
    setNewCount(0)
  }

  const mentionRegex = useMemo(() => nick ? new RegExp(`\\b${nick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') : null, [nick])

  const filteredMessages = useMemo(() => {
    if (!searchTerm) return messages
    const lower = searchTerm.toLowerCase()
    return messages.filter(m => m.text.toLowerCase().includes(lower) || m.from.toLowerCase().includes(lower))
  }, [messages, searchTerm])

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
      {searchOpen && (
        <div className="d-flex align-items-center gap-2 px-2 py-1 border rounded-top bg-light" style={{ flexShrink: 0, borderBottom: 'none' }}>
          <input
            ref={searchInputRef}
            className="form-control form-control-sm font-monospace"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {searchTerm ? `${filteredMessages.length} result${filteredMessages.length !== 1 ? 's' : ''}` : ''}
          </span>
          <button className="btn-close ms-auto" style={{ fontSize: 10 }} onClick={closeSearch} />
        </div>
      )}
      <div
        ref={containerRef}
        className={`border p-3 bg-light font-monospace flex-grow-1${searchOpen ? '' : ' rounded'}`}
        style={{ overflowY: 'auto', fontSize: 16, borderRadius: searchOpen ? '0 0 var(--bs-border-radius) var(--bs-border-radius)' : undefined }}
      >
        {filteredMessages.length === 0 && (
          <span className="text-muted">{searchTerm ? 'No results.' : 'No messages yet.'}</span>
        )}
        {filteredMessages.map((m, i) => {
          const mentioned = (!m.kind || m.kind === 'chat' || m.kind === 'action') &&
            m.from !== nick && !!mentionRegex?.test(m.text)
          return <MessageRow key={i} m={m} mentioned={mentioned} searchTerm={searchTerm} onNickClick={onNickClick} onDeleteMedia={canDeleteMedia ? onDeleteMedia : undefined} />
        })}
        <div ref={endRef} />
      </div>
      {newCount > 0 && !searchOpen && (
        <button
          onClick={scrollToBottom}
          className="btn btn-sm btn-primary"
          style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: 0.9,
            zIndex: 10,
          }}
        >
          ↓ {newCount} new {newCount === 1 ? 'message' : 'messages'}
        </button>
      )}
    </div>
  )
}
