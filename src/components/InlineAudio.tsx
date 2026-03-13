import { useState } from 'react'

const deleteButtonStyle: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4,
  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 3,
  color: '#fff', cursor: 'pointer', padding: '2px 5px', lineHeight: 1,
}

export function InlineAudio({ src, onDelete }: { src: string; onDelete?: (url: string) => void }) {
  const [error, setError] = useState(false)
  if (error) return <span className="text-muted fst-italic">[media unavailable]</span>
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginTop: 4 }}>
      <audio controls src={src} onError={() => setError(true)} style={{ display: 'block', maxWidth: 360 }} />
      {onDelete && <button onClick={() => { if (confirm('Delete this media permanently?')) onDelete(src) }} title="Delete media" style={deleteButtonStyle}>
        <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>delete</span>
      </button>}
    </div>
  )
}
