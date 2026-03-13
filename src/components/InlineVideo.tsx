import { useState } from 'react'

export function InlineVideo({ src }: { src: string }) {
  const [error, setError] = useState(false)
  if (error) return <span className="text-muted fst-italic">[media unavailable]</span>
  return (
    <div style={{ marginTop: '0.5em', marginBottom: '0.5em' }}>
      <video
        src={src}
        controls
        onError={() => setError(true)}
        style={{ maxWidth: 'min(400px, 100%)', maxHeight: 300, display: 'block', borderRadius: 8 }}
      />
    </div>
  )
}
