import { useEffect, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { MediaOverlayActions } from './MediaOverlayActions'

export function InlineImage({ src, onDelete, onRedact }: { src: string; onDelete?: (url: string) => void; onRedact?: (url: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(false)
  const alt = 'User-uploaded image'
  const touchStartY = useRef(0)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const thumbnailBtnRef = useRef<HTMLButtonElement>(null)
  const wasExpandedRef = useRef(false)
  const dialogRef = useFocusTrap<HTMLDivElement>(() => setExpanded(false))

  useEffect(() => {
    if (expanded) {
      wasExpandedRef.current = true
      closeBtnRef.current?.focus()
    } else if (wasExpandedRef.current) {
      thumbnailBtnRef.current?.focus()
    }
  }, [expanded])

  if (error) return <span style={{ color: 'var(--c-disabled-fg)', fontStyle: 'italic' }}>[media unavailable]</span>

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
        <MediaOverlayActions src={src} onDelete={onDelete} onRedact={onRedact} />
      </div>

      {expanded && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setExpanded(false)}
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
