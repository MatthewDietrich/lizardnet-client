import { useState } from 'react'

export function InlineAudio({ src }: { src: string }) {
  const [error, setError] = useState(false)
  if (error) return <span className="text-muted fst-italic">[media unavailable]</span>
  return (
    <audio
      controls
      src={src}
      onError={() => setError(true)}
      style={{ display: 'block', maxWidth: 360, marginTop: 4 }}
    />
  )
}
