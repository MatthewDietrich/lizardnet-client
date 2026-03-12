import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'
import { uploadToS3 } from '../lib/s3Upload'

interface Props {
  connected: boolean
  users: string[]
  commands: string[]
  onSend: (text: string) => void
}

export interface ChatInputHandle {
  setDraft: (text: string) => void
  mention: (nick: string) => void
}

const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput({ connected, users, commands, onSend }, ref) {
  const [input, setInput] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
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
    mention(nick: string) {
      setInput(prev => {
        const trimmed = prev.trim()
        return trimmed ? `${prev} ${nick}` : `${nick}: `
      })
      tabStateRef.current = null
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        const len = inputRef.current?.value.length ?? 0
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

  async function handleFile(file: File) {
    const type = file.type || ''
    if (type && !type.startsWith('image/') && !type.startsWith('video/') && !type.startsWith('audio/')) {
      setUploadError(`Unsupported file type: ${type}`)
      setTimeout(() => setUploadError(null), 4000)
      return
    }
    setUploadError(null)
    setUploadProgress(0)
    try {
      const url = await uploadToS3(file, setUploadProgress)
      setUploadProgress(null)
      onSend(url)
    } catch (e) {
      setUploadProgress(null)
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
      setTimeout(() => setUploadError(null), 4000)
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const file = e.clipboardData.files[0]
    if (!file) return
    e.preventDefault()
    handleFile(file)
  }

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

      const beforePrefix = before.slice(0, before.length - partial.length)
      const isCommand = partial.startsWith('/') && beforePrefix.trim() === ''
      const pool = isCommand ? commands : users
      const matches = pool.filter(u => u.toLowerCase().startsWith(partial.toLowerCase()))
      if (!matches.length) return

      state = {
        matches,
        idx: 0,
        beforePrefix,
        afterCursor: input.slice(cursor),
      }
    } else {
      // Subsequent Tabs — cycle to next match
      state = { ...state, idx: (state.idx + 1) % state.matches.length }
    }

    tabStateRef.current = state

    const completed = state.matches[state.idx]
    const isCommand = completed.startsWith('/')
    const suffix = (!isCommand && state.beforePrefix.length === 0) ? ': ' : ' '
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
          onPaste={handlePaste}
          disabled={!connected}
        />
        <input
          ref={fileInputRef}
          id="chat-file-upload"
          type="file"
          accept="image/*,video/*,audio/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
        <label
          htmlFor="chat-file-upload"
          className={`btn btn-outline-secondary${!connected || uploadProgress !== null ? ' disabled' : ''}`}
          title={uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Upload image or video'}
          style={{ fontSize: 18, lineHeight: 1, minWidth: 38, marginBottom: 0 }}
          onClick={e => { if (!connected || uploadProgress !== null) e.preventDefault() }}
        >
          {uploadProgress !== null
            ? <span style={{ fontSize: 11 }}>{uploadProgress}%</span>
            : <span className="material-icons" style={{ fontSize: 18 }}>attach_file</span>}
        </label>
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
        <button type="submit" className="btn btn-primary d-flex align-items-center gap-1" disabled={!connected}>
          <span className="material-icons" style={{ fontSize: 18 }}>send</span>
        </button>
      </form>
      {uploadError && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, fontSize: 12, color: 'var(--c-tertiary)', background: 'var(--c-surface)', border: '1px solid var(--c-tertiary)', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap', zIndex: 200 }}>
          {uploadError}
        </div>
      )}
    </div>
  )
})

export default ChatInput
