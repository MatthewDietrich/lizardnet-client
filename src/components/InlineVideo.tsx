import { useState } from 'react'
import { overlayButtonStyle } from '../lib/styles'

export function InlineVideo({ src, onDelete, onRedact }: { src: string; onDelete?: (url: string) => void; onRedact?: (url: string) => void }) {
  const [error, setError] = useState(false)
  if (error) return <span className="text-muted fst-italic">[media unavailable]</span>
  return (
    <div style={{ marginTop: '0.5em', marginBottom: '0.5em', position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <video
        src={src}
        controls
        aria-label="User-uploaded video"
        onError={() => setError(true)}
        style={{ maxWidth: 'min(400px, 100%)', maxHeight: 300, display: 'block', borderRadius: 8 }}
      />
      {onDelete && <button aria-label="Delete media" onClick={() => { if (confirm('Delete this media permanently?')) onDelete(src) }} title="Delete media" style={overlayButtonStyle}>
        <span aria-hidden="true" className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>delete</span>
      </button>}
      {!onDelete && onRedact && <button aria-label="Hide media" onClick={() => { if (confirm('Hide this media from chat?')) onRedact(src) }} title="Hide media" style={overlayButtonStyle}>
        <span aria-hidden="true" className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>visibility_off</span>
      </button>}
    </div>
  )
}
