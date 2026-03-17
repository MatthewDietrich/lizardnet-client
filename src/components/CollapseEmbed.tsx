import { useId, useState } from 'react'

export function CollapseEmbed({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  const contentId = useId()

  return (
    <div style={{ marginTop: '0.4em' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`Toggle ${label} embed`}
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 11, color: 'var(--c-tertiary)', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 9 }}>{open ? '▼' : '▶'}</span>
        {label}
      </button>
      {open && <div id={contentId} style={{ marginTop: '0.3em' }}>{children}</div>}
    </div>
  )
}
