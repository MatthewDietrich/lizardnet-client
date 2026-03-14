import { useState } from 'react'
import { overlayButtonStyle } from '../lib/styles'

export function InlineAudio({ src, onDelete, onRedact }: { src: string; onDelete?: (url: string) => void; onRedact?: (url: string) => void }) {
  const [error, setError] = useState(false)
  if (error) return <span className="text-muted fst-italic">[media unavailable]</span>
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginTop: 4 }}>
      <audio controls src={src} onError={() => setError(true)} style={{ display: 'block', maxWidth: 360 }} />
      {onDelete && <button onClick={() => { if (confirm('Delete this media permanently?')) onDelete(src) }} title="Delete media" style={overlayButtonStyle}>
        <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>delete</span>
      </button>}
      {!onDelete && onRedact && <button onClick={() => { if (confirm('Hide this media from chat?')) onRedact(src) }} title="Hide media" style={overlayButtonStyle}>
        <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>visibility_off</span>
      </button>}
    </div>
  )
}
