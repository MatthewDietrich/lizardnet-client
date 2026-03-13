import { useEffect, useRef, useState } from 'react'

const deleteButtonStyle: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4,
  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 3,
  color: '#fff', cursor: 'pointer', padding: '2px 5px', lineHeight: 1,
}

export function InlineImage({ src, onDelete, onRedact }: { src: string; onDelete?: (url: string) => void; onRedact?: (url: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(false)
  const alt = 'User-uploaded image'
  const touchStartY = useRef(0)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const thumbnailBtnRef = useRef<HTMLButtonElement>(null)
  const wasExpandedRef = useRef(false)

  useEffect(() => {
    if (expanded) {
      wasExpandedRef.current = true
      closeBtnRef.current?.focus()
    } else if (wasExpandedRef.current) {
      thumbnailBtnRef.current?.focus()
    }
  }, [expanded])

  function handleOverlayKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setExpanded(false); return }
    if (e.key === 'Tab') { e.preventDefault() } // single focusable element — keep focus on close button
  }

  if (error) return <span className="text-muted fst-italic">[media unavailable]</span>

  return (
    <>
      <div style={{ marginTop: '0.5em', marginBottom: '0.5em', position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <button
          ref={thumbnailBtnRef}
          onClick={() => setExpanded(true)}
          aria-label="View full-size image"
          style={{ background: 'none', border: 'none', padding: 0, display: 'block', cursor: 'zoom-in' }}
        >
          <img
            src={src}
            alt={alt}
            onError={() => setError(true)}
            style={{ maxWidth: 'min(400px, 100%)', maxHeight: 300, display: 'block', borderRadius: 8 }}
          />
        </button>
        {onDelete && <button onClick={() => { if (confirm('Delete this media permanently?')) onDelete(src) }} title="Delete media" style={deleteButtonStyle}>
          <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>delete</span>
        </button>}
        {!onDelete && onRedact && <button onClick={() => { if (confirm('Hide this media from chat?')) onRedact(src) }} title="Hide media" style={deleteButtonStyle}>
          <span className="material-icons" style={{ fontSize: 13, verticalAlign: 'middle' }}>visibility_off</span>
        </button>}
      </div>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setExpanded(false)}
          onKeyDown={handleOverlayKeyDown}
          onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 60) setExpanded(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1050,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
            overscrollBehavior: 'none',
            touchAction: 'pan-down',
          }}
        >
          <button
            ref={closeBtnRef}
            onClick={e => { e.stopPropagation(); setExpanded(false) }}
            aria-label="Close image preview"
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', borderRadius: '50%', width: 36, height: 36,
              fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
          <img
            src={src}
            alt={alt}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
          />
        </div>
      )}
    </>
  )
}
