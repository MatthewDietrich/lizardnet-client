import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'
import { uploadToS3, type BotRequest } from '../lib/s3Upload'
import { useIrcContext } from '../contexts/IrcContext'

interface Props {
  users: string[]
  commands: string[]
  onSend: (text: string) => void
  botRequest: BotRequest
  onTyping?: (state: 'active' | 'paused' | 'done') => void
}

export interface ChatInputHandle {
  setDraft: (text: string) => void
  mention: (nick: string) => void
  focus: () => void
}

const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput({ users, commands, onSend, botRequest, onTyping }, ref) {
  const { connected } = useIrcContext()
  const [input, setInput] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const connectedRef = useRef(connected)
  connectedRef.current = connected
  const uploadProgressRef = useRef(uploadProgress)
  uploadProgressRef.current = uploadProgress
  const onSendRef = useRef(onSend)
  onSendRef.current = onSend
  const botRequestRef = useRef(botRequest)
  botRequestRef.current = botRequest
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSentRef = useRef(0)
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
    focus() {
      inputRef.current?.focus()
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
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowPicker(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('mousedown', onMouseDown); document.removeEventListener('keydown', onKeyDown) }
  }, [showPicker])

  const uploadErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleFile(file: File) {
    const type = file.type || ''
    if (type && !type.startsWith('image/') && !type.startsWith('video/') && !type.startsWith('audio/')) {
      if (uploadErrorTimerRef.current) clearTimeout(uploadErrorTimerRef.current)
      setUploadError(`Unsupported file type: ${type}`)
      uploadErrorTimerRef.current = setTimeout(() => setUploadError(null), 4000)
      return
    }
    setUploadError(null)
    setUploadProgress(0)
    try {
      const url = await uploadToS3(file, botRequestRef.current, setUploadProgress)
      setUploadProgress(null)
      onSendRef.current(url)
    } catch (e) {
      setUploadProgress(null)
      if (uploadErrorTimerRef.current) clearTimeout(uploadErrorTimerRef.current)
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
      uploadErrorTimerRef.current = setTimeout(() => setUploadError(null), 4000)
    }
  }

  const handleFileRef = useRef(handleFile)
  handleFileRef.current = handleFile

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const file = e.clipboardData.files[0]
    if (!file) return
    e.preventDefault()
    handleFile(file)
  }

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      dragCounterRef.current++
      setIsDragging(true)
    }
    function onDragLeave() {
      if (--dragCounterRef.current === 0) setIsDragging(false)
    }
    function onDragOver(e: DragEvent) { e.preventDefault() }
    function onDrop(e: DragEvent) {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragging(false)
      if (!connectedRef.current || uploadProgressRef.current !== null) return
      const file = e.dataTransfer?.files[0]
      if (file) handleFileRef.current(file)
    }
    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
    }
  }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input.trim()) return
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null }
    lastTypingSentRef.current = 0
    onTyping?.('done')
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
      <div aria-live="assertive" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {isDragging ? 'Drop zone active — release to upload file' : ''}
      </div>
      {isDragging && (
        <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 20, color: '#fff', fontStyle: 'italic', border: '2px dashed rgba(255,255,255,0.6)', borderRadius: 8, padding: '24px 48px' }}>
            Drop to upload
          </div>
        </div>
      )}
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
          aria-label="Chat message"
          value={input}
          onChange={e => {
            const val = e.target.value
            setInput(val)
            tabStateRef.current = null
            if (onTyping) {
              if (!val) {
                if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null }
                lastTypingSentRef.current = 0
                onTyping('done')
              } else {
                const now = Date.now()
                if (now - lastTypingSentRef.current > 3_000) { lastTypingSentRef.current = now; onTyping('active') }
                if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
                typingTimerRef.current = setTimeout(() => { typingTimerRef.current = null; onTyping('paused') }, 3_000)
              }
            }
          }}
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
          title={uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Attach file'}
          aria-label={uploadProgress !== null ? `Uploading ${uploadProgress}%` : 'Attach file'}
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
          aria-label="Open emoji picker"
          style={{ fontSize: 18, lineHeight: 1 }}
        >
          😊
        </button>
        <button type="submit" className="btn btn-primary d-flex align-items-center gap-1" disabled={!connected} aria-label="Send message">
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
