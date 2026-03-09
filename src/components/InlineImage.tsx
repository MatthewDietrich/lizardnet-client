import { useEffect, useState } from 'react'

export function InlineImage({ src }: { src: string }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  return (
    <>
      <div style={{ marginTop: '0.5em' }}>
        <img
          src={src}
          alt=""
          onClick={() => setExpanded(true)}
          style={{ maxWidth: 400, maxHeight: 300, display: 'block', borderRadius: 8, cursor: 'zoom-in' }}
        />
      </div>

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1050,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={src}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
          />
        </div>
      )}
    </>
  )
}
