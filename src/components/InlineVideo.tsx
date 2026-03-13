import { useState } from 'react'

const deleteButtonStyle: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4,
  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 3,
  color: '#fff', cursor: 'pointer', padding: '2px 5px', lineHeight: 1,
}

export function InlineVideo({ src, onDelete }: { src: string; onDelete?: (url: string) => void }) {
  const [error, setError] = useState(false)
  if (error) return <span className="text-muted fst-italic">[media unavailable]</span>
  return (
    <div style={{ marginTop: '0.5em', marginBottom: '0.5em', position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <video
        src={src}
        controls
        onError={() => setError(true)}
        style={{ maxWidth: 'min(400px, 100%)', maxHeight: 300, display: 'block', borderRadius: 8 }}
      />
      {onDelete && <button onClick={() => { if (confirm('Delete this media permanently?')) onDelete(src) }} title="Delete media" style={deleteButtonStyle}>
        <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>delete</span>
      </button>}
    </div>
  )
}
