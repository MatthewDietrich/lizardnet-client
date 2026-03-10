import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'

interface Props {
  connected: boolean
  users: string[]
  onSend: (text: string) => void
}

export interface ChatInputHandle {
  setDraft: (text: string) => void
}

const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput({ connected, users, onSend }, ref) {
  const [input, setInput] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tabStateRef = useRef<{
    matches: string[]
    idx: number
    beforePrefix: string  // input text before the partial word
    afterCursor: string   // input text after the cursor at first Tab
  } | null>(null)

  useImperativeHandle(ref, () => ({
    setDraft(text: string) {
      setInput(text)
      tabStateRef.current = null
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        const len = text.length
        inputRef.current?.setSelectionRange(len, len)
      })
    },
  }))

  useEffect(() => {
    if (!showPicker) return
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (
        pickerRef.current && !pickerRef.current.contains(t) &&
        buttonRef.current && !buttonRef.current.contains(t)
      ) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [showPicker])

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Tab') { tabStateRef.current = null; return }
    e.preventDefault()

    let state = tabStateRef.current

    if (!state) {
      // First Tab — find the partial word before the cursor
      const cursor = inputRef.current?.selectionStart ?? input.length
      const before = input.slice(0, cursor)
      const wordMatch = before.match(/(\S+)$/)
      const partial = wordMatch?.[1] ?? ''
      if (!partial) return

      const matches = users.filter(u => u.toLowerCase().startsWith(partial.toLowerCase()))
      if (!matches.length) return

      state = {
        matches,
        idx: 0,
        beforePrefix: before.slice(0, before.length - partial.length),
        afterCursor: input.slice(cursor),
      }
    } else {
      // Subsequent Tabs — cycle to next match
      state = { ...state, idx: (state.idx + 1) % state.matches.length }
    }

    tabStateRef.current = state

    const completed = state.matches[state.idx]
    const suffix = state.beforePrefix.length === 0 ? ': ' : ' '
    const newBefore = state.beforePrefix + completed + suffix
    setInput(newBefore + state.afterCursor)
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(newBefore.length, newBefore.length)
    })
  }

  function onEmojiClick(data: EmojiClickData) {
    setInput(prev => prev + data.emoji)
    setShowPicker(false)
    inputRef.current?.focus()
  }

  return (
    <div style={{ position: 'relative' }}>
      {showPicker && (
        <div ref={pickerRef} style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, zIndex: 100 }}>
          <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} lazyLoadEmojis />
        </div>
      )}
      <form onSubmit={handleSubmit} className="d-flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          className="form-control"
          placeholder="Type a message..."
          value={input}
          onChange={e => { setInput(e.target.value); tabStateRef.current = null }}
          onKeyDown={handleKeyDown}
          disabled={!connected}
        />
        <button
          ref={buttonRef}
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setShowPicker(v => !v)}
          disabled={!connected}
          title="Emoji picker"
          style={{ fontSize: 18, lineHeight: 1 }}
        >
          😊
        </button>
        <button type="submit" className="btn btn-primary" disabled={!connected}>Send</button>
      </form>
    </div>
  )
})

export default ChatInput
