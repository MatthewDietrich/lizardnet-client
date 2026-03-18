import { useRef, useMemo, memo, useLayoutEffect, useState, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { parseIrc, isMediaNode } from '../ircFormat'
import type { Message } from '../types'
import { useIrcContext } from '../contexts/IrcContext'

export interface MessageActions {
  canDeleteUrl?: (url: string) => boolean
  onDeleteMedia?: (url: string) => void
  canRedactUrl?: (url: string) => boolean
  onRedactMedia?: (url: string) => void
  onEdit?: (msgid: string, newText: string) => void
  onDeleteMsg?: (msgid: string) => void
}

interface Props {
  messages: Message[]
  onNickClick?: (nick: string, pos: { x: number; y: number }) => void
  actions?: MessageActions
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

const MessageRow = memo(function MessageRow({ m, mentioned, searchTerm, onNickClick, actions }: { m: Message; mentioned: boolean; searchTerm: string; onNickClick?: (nick: string, pos: { x: number; y: number }) => void; actions?: MessageActions }) {
  const { onDeleteMedia, canDeleteUrl, onRedactMedia, canRedactUrl, onEdit, onDeleteMsg } = actions ?? {}
  const { nick, isOper } = useIrcContext()
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const isMediaOnly = /^https:\/\/lizardnet-media\.s3\.amazonaws\.com\/\S+$/.test(m.text.trim())
  const canEdit = !!(onEdit && m.msgid && m.from === nick && (!m.kind || m.kind === 'chat') && !isMediaOnly && !m.deleted)
  const canDeleteMsg = !!(onDeleteMsg && m.msgid && isOper && !m.deleted)

  const ts = <span style={{ fontSize: 11, color: 'var(--c-disabled-fg)', whiteSpace: 'nowrap' }}>{m.ts.toLocaleTimeString()}</span>
  const parsed = searchTerm ? highlight(m.text, searchTerm) : parseIrc(m.text, { onDelete: onDeleteMedia, canDelete: canDeleteUrl, onRedact: onRedactMedia, canRedact: canRedactUrl })
  const textNodes = Array.isArray(parsed) ? parsed.filter(n => !isMediaNode(n)) : parsed
  const mediaNodes = Array.isArray(parsed) ? parsed.filter(n => isMediaNode(n)) : []
  const fromText = searchTerm ? highlight(m.from, searchTerm) : m.from
  const from = m.from && m.from !== '*' && m.kind !== 'event' && onNickClick
    ? <strong style={{ cursor: 'pointer' }} onClick={e => onNickClick(m.from, { x: e.clientX, y: e.clientY })}>{fromText}</strong>
    : <strong>{fromText}</strong>
  const editedTag = m.edited ? <span title={`Original: "${m.originalText}"`} style={{ fontSize: 10, color: 'var(--c-tertiary)', marginLeft: '0.3em', cursor: 'help' }}>(edited)</span> : null
  const editBtn = canEdit && hovered && !editing
    ? <button onClick={() => { setDraft(m.text); setEditing(true) }} style={{ background: 'none', border: 'none', padding: '0 0.3em', fontSize: 12, color: 'var(--c-tertiary)', cursor: 'pointer', lineHeight: 1 }} title="Edit message" aria-label="Edit message">✎</button>
    : null
  const deleteBtn = canDeleteMsg && hovered && !editing
    ? <button onClick={() => { if (confirm('Delete this message for everyone?')) onDeleteMsg!(m.msgid!) }} style={{ background: 'none', border: 'none', padding: '0 0.3em', fontSize: 12, color: 'var(--c-tertiary)', cursor: 'pointer', lineHeight: 1 }} title="Delete message" aria-label="Delete message">🗑</button>
    : null

  function submitEdit() {
    if (draft.trim() && draft.trim() !== m.text && m.msgid) onEdit?.(m.msgid, draft.trim())
    setEditing(false)
  }

  const inlineEditor = (
    <input
      aria-label="Edit message"
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { submitEdit(); e.preventDefault() }
        if (e.key === 'Escape') { setEditing(false); e.preventDefault() }
      }}
      onBlur={() => setEditing(false)}
      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--c-border)', outline: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', width: '100%', padding: 0 }}
    />
  )

  if (m.deleted) return (
    <div className="fst-italic" style={{ ...gridRow, fontSize: 12, color: 'var(--c-disabled-fg)' }}>
      {ts}<div>[message deleted]</div>
    </div>
  )
  if (m.kind === 'event') return (
    <div className="fst-italic" style={{ ...gridRow, fontSize: 12, color: 'var(--c-tertiary)' }}>
      {ts}<div>{searchTerm ? highlight(m.text, searchTerm) : parseIrc(m.text, { onDelete: onDeleteMedia })}</div>
    </div>
  )
  if (m.kind === 'action') return (
    <div className="fst-italic" style={mentioned ? { ...gridRow, ...mentionStyle } : gridRow}>
      {ts}
      <div>
        <div>{from} {textNodes}{editedTag}</div>
        {mediaNodes.length > 0 && <div style={{ marginTop: 4 }}>{mediaNodes}</div>}
      </div>
    </div>
  )
  if (m.kind === 'pm') return (
    <div style={{ ...gridRow, color: 'var(--c-quaternary)' }}>
      {ts}
      <div>
        <div><span style={{ opacity: 0.6 }}>[PM]</span> {from}: {textNodes}{editedTag}</div>
        {mediaNodes.length > 0 && <div style={{ marginTop: 4 }}>{mediaNodes}</div>}
      </div>
    </div>
  )
  const emojiOnly = EMOJI_ONLY_RE.test(m.text.trim())
  return (
    <div
      style={mentioned ? { ...gridRow, ...mentionStyle } : gridRow}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {ts}
      <div>
        <div>
          {from}:{' '}
          {editing
            ? inlineEditor
            : emojiOnly
              ? <span style={{ fontSize: 36, lineHeight: 1.1 }}>{textNodes}</span>
              : textNodes
          }
          {!editing && editedTag}
          {editBtn}
          {deleteBtn}
        </div>
        {mediaNodes.length > 0 && <div style={{ marginTop: 4 }}>{mediaNodes}</div>}
      </div>
    </div>
  )
})

export default function MessageList({ messages, onNickClick, actions }: Props) {
  const { nick } = useIrcContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const atBottomRef = useRef(true)
  const prevLengthRef = useRef(0)
  const [newCount, setNewCount] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [liveText, setLiveText] = useState('')
  const prevLiveLengthRef = useRef(0)

  useEffect(() => {
    if (messages.length <= prevLiveLengthRef.current) {
      prevLiveLengthRef.current = messages.length
      return
    }
    prevLiveLengthRef.current = messages.length
    const m = messages[messages.length - 1]
    if (!m) return
    const plain = m.text
      .replace(/\x03\d{1,2}(,\d{1,2})?/g, '')
      .replace(/[\x02\x03\x1d\x1f\x16\x0f]/g, '')
    let announcement: string
    if (m.kind === 'event') announcement = plain
    else if (m.kind === 'action') announcement = `* ${m.from} ${plain}`
    else if (m.kind === 'pm') announcement = `[PM] ${m.from}: ${plain}`
    else announcement = `${m.from}: ${plain}`
    setLiveText(announcement)
  }, [messages])

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

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) endRef.current?.scrollIntoView()
    })
    ro.observe(inner)
    return () => ro.disconnect()
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

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchTerm('')
    atBottomRef.current = true
    setTimeout(() => endRef.current?.scrollIntoView(), 0)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        flushSync(() => setSearchOpen(true))
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        closeSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeSearch])

  function scrollToBottom() {
    atBottomRef.current = true
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
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {liveText}
      </div>
      {searchOpen && (
        <div className="d-flex align-items-center gap-2 px-2 py-1 border rounded-top bg-light" style={{ flexShrink: 0, borderBottom: 'none' }}>
          <input
            ref={searchInputRef}
            className="form-control form-control-sm font-monospace"
            aria-label="Search messages"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {searchTerm ? `${filteredMessages.length} result${filteredMessages.length !== 1 ? 's' : ''}` : ''}
          </span>
          <button className="btn-close ms-auto" style={{ fontSize: 10 }} onClick={closeSearch} aria-label="Close search" />
        </div>
      )}
      <div
        ref={containerRef}
        className={`border p-3 bg-light font-monospace flex-grow-1${searchOpen ? '' : ' rounded'}`}
        style={{ overflowY: 'auto', overflowX: 'hidden', fontSize: 16, borderRadius: searchOpen ? '0 0 var(--bs-border-radius) var(--bs-border-radius)' : undefined }}
      >
        {filteredMessages.length === 0 && (
          <span className="text-muted">{searchTerm ? 'No results.' : 'No messages yet.'}</span>
        )}
        <div ref={innerRef}>
          {filteredMessages.map((m) => {
            const mentioned = (!m.kind || m.kind === 'chat' || m.kind === 'action') &&
              m.from !== nick && !!mentionRegex?.test(m.text)
            return <MessageRow key={m.id} m={m} mentioned={mentioned} searchTerm={searchTerm} onNickClick={onNickClick} actions={actions} />
          })}
          <div ref={endRef} />
        </div>
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
