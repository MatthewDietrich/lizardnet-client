import { useState } from 'react'
import { MediaOverlayActions } from './MediaOverlayActions'

export function InlineVideo({ src, onDelete, onRedact }: { src: string; onDelete?: (url: string) => void; onRedact?: (url: string) => void }) {
  const [error, setError] = useState(false)
  if (error) return <span style={{ color: 'var(--c-disabled-fg)', fontStyle: 'italic' }}>[media unavailable]</span>
  return (
    <div style={{ marginTop: '0.5em', marginBottom: '0.5em', position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <video
        src={src}
        controls
        aria-label="User-uploaded video"
        onError={() => setError(true)}
        style={{ maxWidth: 'min(400px, 100%)', maxHeight: 300, display: 'block', borderRadius: 8 }}
      />
      <MediaOverlayActions src={src} onDelete={onDelete} onRedact={onRedact} />
    </div>
  )
}
