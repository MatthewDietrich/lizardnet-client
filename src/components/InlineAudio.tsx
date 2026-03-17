import { useState } from 'react'
import { MediaOverlayActions } from './MediaOverlayActions'

export function InlineAudio({ src, onDelete, onRedact }: { src: string; onDelete?: (url: string) => void; onRedact?: (url: string) => void }) {
  const [error, setError] = useState(false)
  if (error) return <span className="text-muted fst-italic">[media unavailable]</span>
  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginTop: 4 }}>
      <audio controls src={src} aria-label="User-uploaded audio" onError={() => setError(true)} style={{ display: 'block', maxWidth: 360 }} />
      <MediaOverlayActions src={src} onDelete={onDelete} onRedact={onRedact} />
    </div>
  )
}
