import { useState } from 'react'

interface Props {
  topic: string
  isOper: boolean
  onChangeTopic: (topic: string) => void
}

export default function TopicBar({ topic, isOper, onChangeTopic }: Props) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    onChangeTopic(input)
    setEditing(false)
  }

  return (
    <div className="mb-2 px-2 py-1 border rounded font-monospace" style={{ fontSize: 12, color: 'var(--c-primary)', background: 'var(--c-bg)' }}>
      {editing ? (
        <form className="d-flex gap-2" onSubmit={handleSubmit}>
          <input
            autoFocus
            className="form-control form-control-sm"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && setEditing(false)}
          />
          <button type="submit" className="btn btn-sm btn-outline-success">Set</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      ) : isOper ? (
        <button
          title="Click to edit topic"
          onClick={() => { setInput(topic); setEditing(true) }}
          style={{ background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
        >
          Topic: {topic || <span className="text-muted">No topic set</span>}
        </button>
      ) : (
        <span>Topic: {topic || <span className="text-muted">No topic set</span>}</span>
      )}
    </div>
  )
}
