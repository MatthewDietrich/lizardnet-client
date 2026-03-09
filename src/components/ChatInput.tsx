import { useState } from 'react'

interface Props {
  connected: boolean
  onSend: (text: string) => void
}

export default function ChatInput({ connected, onSend }: Props) {
  const [input, setInput] = useState('')

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!input.trim()) return
    onSend(input)
    setInput('')
  }

  return (
    <form onSubmit={handleSubmit} className="d-flex gap-2 flex-shrink-0">
      <input
        className="form-control"
        placeholder="Type a message..."
        value={input}
        onChange={e => setInput(e.target.value)}
        disabled={!connected}
      />
      <button type="submit" className="btn btn-primary" disabled={!connected}>Send</button>
    </form>
  )
}
