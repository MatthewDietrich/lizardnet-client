import { useState, useRef, useEffect } from 'react'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'

interface Props {
  connected: boolean
  onSend: (text: string) => void
}

export default function ChatInput({ connected, onSend }: Props) {
  const [input, setInput] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
          onChange={e => setInput(e.target.value)}
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
}
